import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { DB, DB_TX } from '../db/db.module';
import { candidateProfiles, candidateSkills } from '../db/candidates';
import { skills } from '../db/skills';
import { assertCountryAllowed } from '../db/countries.helpers';
import { SkillsService } from '../skills/skills.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';
import { isValidTimezone } from './is-valid-timezone';

export type CandidateProfile = typeof candidateProfiles.$inferSelect;
export interface CandidateSkillSummary {
  id: string;
  slug: string;
  name: string;
}

@Injectable()
export class CandidatesService {
  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase,
    @Inject(DB_TX) private readonly dbTx: NeonDatabase,
    private readonly skillsService: SkillsService,
  ) {}

  async getOwnProfile(userId: string): Promise<CandidateProfile> {
    const profile = await this.findProfile(userId);
    if (!profile) {
      throw new NotFoundException('Candidate profile not found.');
    }
    return profile;
  }

  async createProfile(
    userId: string,
    dto: CreateCandidateProfileDto,
  ): Promise<CandidateProfile> {
    const existing = await this.findProfile(userId);
    if (existing) {
      throw new ConflictException('Candidate profile already exists.');
    }

    const countryCode = await assertCountryAllowed(
      this.db,
      dto.countryCode,
      'candidateAllowed',
      'candidates',
    );
    this.assertValidTimezone(dto.timezone);
    this.assertSalaryConsistent({
      min: dto.salaryExpectationMin,
      max: dto.salaryExpectationMax,
      currency: dto.salaryCurrency,
      period: dto.salaryPeriod,
    });

    const [inserted] = await this.db
      .insert(candidateProfiles)
      .values({
        userId,
        fullName: dto.fullName,
        headline: dto.headline,
        bio: dto.bio,
        githubUrl: dto.githubUrl,
        portfolioUrl: dto.portfolioUrl,
        countryCode,
        timezone: dto.timezone,
        availability: dto.availability,
        salaryExpectationMin: dto.salaryExpectationMin,
        salaryExpectationMax: dto.salaryExpectationMax,
        salaryCurrency: dto.salaryCurrency?.toUpperCase(),
        salaryPeriod: dto.salaryPeriod,
      })
      .returning();

    return inserted;
  }

  async updateProfile(
    userId: string,
    dto: UpdateCandidateProfileDto,
  ): Promise<CandidateProfile> {
    const existing = await this.findProfile(userId);
    if (!existing) {
      throw new NotFoundException('Candidate profile not found.');
    }

    const updateValues: Partial<typeof candidateProfiles.$inferInsert> = {};

    if (dto.fullName !== undefined) updateValues.fullName = dto.fullName;
    if (dto.headline !== undefined) updateValues.headline = dto.headline;
    if (dto.bio !== undefined) updateValues.bio = dto.bio;
    if (dto.githubUrl !== undefined) updateValues.githubUrl = dto.githubUrl;
    if (dto.portfolioUrl !== undefined)
      updateValues.portfolioUrl = dto.portfolioUrl;
    if (dto.availability !== undefined)
      updateValues.availability = dto.availability;
    if (dto.salaryExpectationMin !== undefined)
      updateValues.salaryExpectationMin = dto.salaryExpectationMin;
    if (dto.salaryExpectationMax !== undefined)
      updateValues.salaryExpectationMax = dto.salaryExpectationMax;
    if (dto.salaryCurrency !== undefined)
      updateValues.salaryCurrency = dto.salaryCurrency.toUpperCase();
    if (dto.salaryPeriod !== undefined)
      updateValues.salaryPeriod = dto.salaryPeriod;

    if (dto.countryCode !== undefined) {
      updateValues.countryCode = await assertCountryAllowed(
        this.db,
        dto.countryCode,
        'candidateAllowed',
        'candidates',
      );
    }

    if (dto.timezone !== undefined) {
      this.assertValidTimezone(dto.timezone);
      updateValues.timezone = dto.timezone;
    }

    // Validate the resulting merged state, not just the patch — e.g. a
    // patch that only removes salaryCurrency while min/max stay set
    // from before must still be rejected.
    this.assertSalaryConsistent({
      min:
        updateValues.salaryExpectationMin ??
        existing.salaryExpectationMin ??
        undefined,
      max:
        updateValues.salaryExpectationMax ??
        existing.salaryExpectationMax ??
        undefined,
      currency:
        updateValues.salaryCurrency ?? existing.salaryCurrency ?? undefined,
      period: updateValues.salaryPeriod ?? existing.salaryPeriod ?? undefined,
    });

    if (Object.keys(updateValues).length === 0) {
      return existing;
    }

    const [updated] = await this.db
      .update(candidateProfiles)
      .set(updateValues)
      .where(eq(candidateProfiles.userId, userId))
      .returning();

    return updated;
  }

  async replaceSkills(
    userId: string,
    skillIds: string[],
  ): Promise<CandidateSkillSummary[]> {
    const existing = await this.findProfile(userId);
    if (!existing) {
      throw new NotFoundException(
        'Candidate profile not found. Create a profile before adding skills.',
      );
    }

    const uniqueIds = [...new Set(skillIds)];

    if (uniqueIds.length > 0) {
      const found = await this.skillsService.getManyByIds(uniqueIds);
      const foundById = new Map(found.map((f) => [f.id, f]));

      const unknown = uniqueIds.filter((id) => !foundById.has(id));
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Unknown skill id(s): ${unknown.join(', ')}`,
        );
      }

      const inactive = uniqueIds.filter(
        (id) => foundById.get(id)?.isActive === false,
      );
      if (inactive.length > 0) {
        throw new BadRequestException(
          `Inactive skill id(s) cannot be added: ${inactive.join(', ')}`,
        );
      }
    }

    // Real transaction (see db/db.module.ts DB_TX) — delete and
    // re-insert must be atomic, or a crash between the two would leave
    // a candidate with zero skills instead of the old or new set.
    await this.dbTx.transaction(async (tx) => {
      await tx
        .delete(candidateSkills)
        .where(eq(candidateSkills.candidateId, userId));
      if (uniqueIds.length > 0) {
        await tx
          .insert(candidateSkills)
          .values(
            uniqueIds.map((skillId) => ({ candidateId: userId, skillId })),
          );
      }
    });

    return this.getSkills(userId);
  }

  async getSkills(userId: string): Promise<CandidateSkillSummary[]> {
    return this.db
      .select({ id: skills.id, slug: skills.slug, name: skills.name })
      .from(candidateSkills)
      .innerJoin(skills, eq(candidateSkills.skillId, skills.id))
      .where(eq(candidateSkills.candidateId, userId))
      .orderBy(skills.name);
  }

  private async findProfile(
    userId: string,
  ): Promise<CandidateProfile | undefined> {
    const [profile] = await this.db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId));
    return profile;
  }

  private assertValidTimezone(timezone: string): void {
    if (!isValidTimezone(timezone)) {
      throw new BadRequestException(
        `'${timezone}' is not a valid IANA timezone name.`,
      );
    }
  }

  private assertSalaryConsistent(salary: {
    min?: number;
    max?: number;
    currency?: string;
    period?: string;
  }): void {
    const { min, max, currency, period } = salary;
    if (min !== undefined && min < 0) {
      throw new BadRequestException('salaryExpectationMin cannot be negative.');
    }
    if (max !== undefined && max < 0) {
      throw new BadRequestException('salaryExpectationMax cannot be negative.');
    }
    if (min !== undefined && max !== undefined && max < min) {
      throw new BadRequestException(
        'salaryExpectationMax cannot be less than salaryExpectationMin.',
      );
    }
    const hasAmount = min !== undefined || max !== undefined;
    if (hasAmount && (!currency || !period)) {
      throw new BadRequestException(
        'salaryCurrency and salaryPeriod are both required when a salary expectation is set.',
      );
    }
  }
}
