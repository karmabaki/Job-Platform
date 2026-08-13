import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { DB, DB_TX } from '../db/db.module';
import {
  candidateProfiles,
  candidateSkills,
  candidateLanguages,
  candidatePortfolioItems,
  candidateWorkHistory,
  candidateEducation,
} from '../db/candidates';
import { skills } from '../db/skills';
import { assertCountryAllowed } from '../db/countries.helpers';
import { SkillsService } from '../skills/skills.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';
import { CandidateLanguageItemDto } from './dto/replace-candidate-languages.dto';
import { CandidatePortfolioItemDto } from './dto/replace-candidate-portfolio.dto';
import { CandidateWorkHistoryItemDto } from './dto/replace-candidate-work-history.dto';
import { CandidateEducationItemDto } from './dto/replace-candidate-education.dto';
import { isValidTimezone } from '../common/is-valid-timezone';
import { isValidLanguageCode } from '../common/is-valid-language-code';
import { assertSalaryConsistent } from '../common/assert-salary-consistent';
import { assertValidDateRange } from '../common/assert-valid-date-range';

export type CandidateProfile = typeof candidateProfiles.$inferSelect;
export type CandidateLanguage = typeof candidateLanguages.$inferSelect;
export type CandidatePortfolioItem =
  typeof candidatePortfolioItems.$inferSelect;
export type CandidateWorkHistoryEntry =
  typeof candidateWorkHistory.$inferSelect;
export type CandidateEducationEntry = typeof candidateEducation.$inferSelect;
export interface CandidateSkillSummary {
  id: string;
  slug: string;
  name: string;
}

// Deliberately excludes user_id (== users.id, per the shared-PK
// design in docs/database-design.md) as well as anything from the
// `users` table (email, password_hash) — this is what applications
// module embeds in an employer's view of an applicant. See Phase 5's
// "never include the candidate's email, password_hash, or user id"
// rule; excluded at the query level, not by trusting a later
// destructure/omit, so a future change here can't silently reintroduce
// the leak.
export interface EmployerVisibleCandidateProfile {
  fullName: string;
  headline: string | null;
  bio: string | null;
  githubUrl: string | null;
  countryCode: string;
  timezone: string;
  availability: string;
  salaryExpectationMin: number | null;
  salaryExpectationMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}

// See docs/database-design.md Key decision #8 — must stay in sync
// with that document if either ever changes.
const COMPLETENESS_WEIGHTS = {
  headline: 10,
  bio: 10,
  skills: 15,
  languages: 10,
  evidence: 15, // github_url set OR >=1 portfolio item
  workHistory: 15,
  education: 5,
  salary: 15, // min, max, currency, period all set
  totalYearsExperience: 5,
} as const;

// Deliberate early-stage setting (marketplace has no supply yet), not
// a permanent judgment about candidate quality — see Key decision #8.
const SEARCHABLE_THRESHOLD = 55;

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
    assertSalaryConsistent({
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
        countryCode,
        timezone: dto.timezone,
        availability: dto.availability,
        salaryExpectationMin: dto.salaryExpectationMin,
        salaryExpectationMax: dto.salaryExpectationMax,
        salaryCurrency: dto.salaryCurrency?.toUpperCase(),
        salaryPeriod: dto.salaryPeriod,
        totalYearsExperience: dto.totalYearsExperience,
      })
      .returning();

    return this.recalculateCompleteness(inserted.userId);
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
    if (dto.totalYearsExperience !== undefined)
      updateValues.totalYearsExperience = dto.totalYearsExperience;

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
    assertSalaryConsistent({
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

    if (Object.keys(updateValues).length > 0) {
      await this.db
        .update(candidateProfiles)
        .set(updateValues)
        .where(eq(candidateProfiles.userId, userId));
    }

    // Always recalculate, even for a no-op patch — cheap, and keeps
    // this the single place completeness can ever go stale from.
    return this.recalculateCompleteness(userId);
  }

  async replaceSkills(
    userId: string,
    skillIds: string[],
  ): Promise<CandidateSkillSummary[]> {
    await this.assertProfileExists(userId, 'skills');

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

    await this.recalculateCompleteness(userId);
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

  async replaceLanguages(
    userId: string,
    items: CandidateLanguageItemDto[],
  ): Promise<CandidateLanguage[]> {
    await this.assertProfileExists(userId, 'languages');

    const codes = items.map((l) => l.languageCode.toLowerCase());
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException(
        'Duplicate language codes are not allowed.',
      );
    }

    const invalid = items.filter(
      (l) => !isValidLanguageCode(l.languageCode.toLowerCase()),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid ISO 639-1 language code(s): ${invalid.map((l) => l.languageCode).join(', ')}`,
      );
    }

    await this.dbTx.transaction(async (tx) => {
      await tx
        .delete(candidateLanguages)
        .where(eq(candidateLanguages.candidateId, userId));
      if (items.length > 0) {
        await tx.insert(candidateLanguages).values(
          items.map((l) => ({
            candidateId: userId,
            languageCode: l.languageCode.toLowerCase(),
            proficiency: l.proficiency,
          })),
        );
      }
    });

    await this.recalculateCompleteness(userId);
    return this.getLanguages(userId);
  }

  async getLanguages(userId: string): Promise<CandidateLanguage[]> {
    return this.db
      .select()
      .from(candidateLanguages)
      .where(eq(candidateLanguages.candidateId, userId))
      .orderBy(candidateLanguages.languageCode);
  }

  async replacePortfolio(
    userId: string,
    items: CandidatePortfolioItemDto[],
  ): Promise<CandidatePortfolioItem[]> {
    await this.assertProfileExists(userId, 'portfolio items');

    await this.dbTx.transaction(async (tx) => {
      await tx
        .delete(candidatePortfolioItems)
        .where(eq(candidatePortfolioItems.candidateId, userId));
      if (items.length > 0) {
        await tx.insert(candidatePortfolioItems).values(
          items.map((item, index) => ({
            candidateId: userId,
            title: item.title,
            description: item.description,
            url: item.url,
            sortOrder: index,
          })),
        );
      }
    });

    await this.recalculateCompleteness(userId);
    return this.getPortfolio(userId);
  }

  async getPortfolio(userId: string): Promise<CandidatePortfolioItem[]> {
    return this.db
      .select()
      .from(candidatePortfolioItems)
      .where(eq(candidatePortfolioItems.candidateId, userId))
      .orderBy(candidatePortfolioItems.sortOrder);
  }

  async replaceWorkHistory(
    userId: string,
    items: CandidateWorkHistoryItemDto[],
  ): Promise<CandidateWorkHistoryEntry[]> {
    await this.assertProfileExists(userId, 'work history');

    items.forEach((item, index) =>
      assertValidDateRange(item, `Work history entry #${index + 1}`),
    );

    await this.dbTx.transaction(async (tx) => {
      await tx
        .delete(candidateWorkHistory)
        .where(eq(candidateWorkHistory.candidateId, userId));
      if (items.length > 0) {
        await tx.insert(candidateWorkHistory).values(
          items.map((item, index) => ({
            candidateId: userId,
            roleTitle: item.roleTitle,
            companyName: item.companyName,
            description: item.description,
            startYear: item.startYear,
            startMonth: item.startMonth,
            endYear: item.endYear,
            endMonth: item.endMonth,
            isCurrent: item.isCurrent ?? false,
            sortOrder: index,
          })),
        );
      }
    });

    await this.recalculateCompleteness(userId);
    return this.getWorkHistory(userId);
  }

  async getWorkHistory(userId: string): Promise<CandidateWorkHistoryEntry[]> {
    return this.db
      .select()
      .from(candidateWorkHistory)
      .where(eq(candidateWorkHistory.candidateId, userId))
      .orderBy(candidateWorkHistory.sortOrder);
  }

  async replaceEducation(
    userId: string,
    items: CandidateEducationItemDto[],
  ): Promise<CandidateEducationEntry[]> {
    await this.assertProfileExists(userId, 'education');

    items.forEach((item, index) =>
      assertValidDateRange(item, `Education entry #${index + 1}`),
    );

    await this.dbTx.transaction(async (tx) => {
      await tx
        .delete(candidateEducation)
        .where(eq(candidateEducation.candidateId, userId));
      if (items.length > 0) {
        await tx.insert(candidateEducation).values(
          items.map((item, index) => ({
            candidateId: userId,
            institutionName: item.institutionName,
            degree: item.degree,
            fieldOfStudy: item.fieldOfStudy,
            description: item.description,
            startYear: item.startYear,
            startMonth: item.startMonth,
            endYear: item.endYear,
            endMonth: item.endMonth,
            isCurrent: item.isCurrent ?? false,
            sortOrder: index,
          })),
        );
      }
    });

    await this.recalculateCompleteness(userId);
    return this.getEducation(userId);
  }

  async getEducation(userId: string): Promise<CandidateEducationEntry[]> {
    return this.db
      .select()
      .from(candidateEducation)
      .where(eq(candidateEducation.candidateId, userId))
      .orderBy(candidateEducation.sortOrder);
  }

  // Existence check only — used by applications module to reject
  // "apply to a job" when the candidate has no profile yet, without
  // handing back any profile data it doesn't need.
  async hasProfile(userId: string): Promise<boolean> {
    const profile = await this.findProfile(userId);
    return profile !== undefined;
  }

  // For applications module's employer-facing application view —
  // see EmployerVisibleCandidateProfile above for what's deliberately
  // excluded and why.
  async getProfileForEmployerView(
    userId: string,
  ): Promise<EmployerVisibleCandidateProfile | undefined> {
    const [profile] = await this.db
      .select({
        fullName: candidateProfiles.fullName,
        headline: candidateProfiles.headline,
        bio: candidateProfiles.bio,
        githubUrl: candidateProfiles.githubUrl,
        countryCode: candidateProfiles.countryCode,
        timezone: candidateProfiles.timezone,
        availability: candidateProfiles.availability,
        salaryExpectationMin: candidateProfiles.salaryExpectationMin,
        salaryExpectationMax: candidateProfiles.salaryExpectationMax,
        salaryCurrency: candidateProfiles.salaryCurrency,
        salaryPeriod: candidateProfiles.salaryPeriod,
      })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId));
    return profile;
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

  private async assertProfileExists(
    userId: string,
    resource: string,
  ): Promise<void> {
    const exists = await this.hasProfile(userId);
    if (!exists) {
      throw new NotFoundException(
        `Candidate profile not found. Create a profile before adding ${resource}.`,
      );
    }
  }

  private assertValidTimezone(timezone: string): void {
    if (!isValidTimezone(timezone)) {
      throw new BadRequestException(
        `'${timezone}' is not a valid IANA timezone name.`,
      );
    }
  }

  // Recalculated on every write to candidate_profiles or any of the
  // four Phase 4.5 tables — see docs/database-design.md's Operational
  // notes ("profile_completeness recalculation") and Key decision #8
  // for the weighting formula and threshold this must stay in sync
  // with.
  private async recalculateCompleteness(
    candidateId: string,
  ): Promise<CandidateProfile> {
    const [profile] = await this.db
      .select({
        headline: candidateProfiles.headline,
        bio: candidateProfiles.bio,
        githubUrl: candidateProfiles.githubUrl,
        salaryExpectationMin: candidateProfiles.salaryExpectationMin,
        salaryExpectationMax: candidateProfiles.salaryExpectationMax,
        salaryCurrency: candidateProfiles.salaryCurrency,
        salaryPeriod: candidateProfiles.salaryPeriod,
        totalYearsExperience: candidateProfiles.totalYearsExperience,
      })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, candidateId));

    const [
      [{ n: skillsCount }],
      [{ n: languagesCount }],
      [{ n: portfolioCount }],
      [{ n: workHistoryCount }],
      [{ n: educationCount }],
    ] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(candidateSkills)
        .where(eq(candidateSkills.candidateId, candidateId)),
      this.db
        .select({ n: count() })
        .from(candidateLanguages)
        .where(eq(candidateLanguages.candidateId, candidateId)),
      this.db
        .select({ n: count() })
        .from(candidatePortfolioItems)
        .where(eq(candidatePortfolioItems.candidateId, candidateId)),
      this.db
        .select({ n: count() })
        .from(candidateWorkHistory)
        .where(eq(candidateWorkHistory.candidateId, candidateId)),
      this.db
        .select({ n: count() })
        .from(candidateEducation)
        .where(eq(candidateEducation.candidateId, candidateId)),
    ]);

    let score = 0;
    if (profile.headline) score += COMPLETENESS_WEIGHTS.headline;
    if (profile.bio) score += COMPLETENESS_WEIGHTS.bio;
    if (skillsCount > 0) score += COMPLETENESS_WEIGHTS.skills;
    if (languagesCount > 0) score += COMPLETENESS_WEIGHTS.languages;
    if (profile.githubUrl || portfolioCount > 0)
      score += COMPLETENESS_WEIGHTS.evidence;
    if (workHistoryCount > 0) score += COMPLETENESS_WEIGHTS.workHistory;
    if (educationCount > 0) score += COMPLETENESS_WEIGHTS.education;

    const salaryComplete =
      profile.salaryExpectationMin != null &&
      profile.salaryExpectationMax != null &&
      profile.salaryCurrency != null &&
      profile.salaryPeriod != null;
    if (salaryComplete) score += COMPLETENESS_WEIGHTS.salary;

    if (profile.totalYearsExperience != null)
      score += COMPLETENESS_WEIGHTS.totalYearsExperience;

    const [updated] = await this.db
      .update(candidateProfiles)
      .set({
        profileCompleteness: score,
        isSearchable: score >= SEARCHABLE_THRESHOLD,
      })
      .where(eq(candidateProfiles.userId, candidateId))
      .returning();

    return updated;
  }
}
