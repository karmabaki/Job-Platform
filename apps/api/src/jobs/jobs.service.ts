import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, exists, ilike, inArray } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { DB, DB_TX } from '../db/db.module';
import { jobs, jobSkills } from '../db/jobs';
import { companies } from '../db/companies';
import { users } from '../db/users';
import { skills } from '../db/skills';
import { assertSalaryConsistent } from '../common/assert-salary-consistent';
import { isValidTimezone } from '../common/is-valid-timezone';
import { SkillsService } from '../skills/skills.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';

export type Job = typeof jobs.$inferSelect;
export interface JobSkillSummary {
  id: string;
  slug: string;
  name: string;
}
export interface JobCompanySummary {
  id: string;
  name: string;
  countryCode: string;
}
export interface JobListItem {
  id: string;
  title: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  timezoneAnchor: string | null;
  timezoneOverlapHours: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  company: JobCompanySummary;
}
export interface JobDetail extends JobListItem {
  description: string;
  status: string;
  skills: JobSkillSummary[];
}

const LIST_COLUMNS = {
  id: jobs.id,
  title: jobs.title,
  salaryMin: jobs.salaryMin,
  salaryMax: jobs.salaryMax,
  salaryCurrency: jobs.salaryCurrency,
  salaryPeriod: jobs.salaryPeriod,
  timezoneAnchor: jobs.timezoneAnchor,
  timezoneOverlapHours: jobs.timezoneOverlapHours,
  publishedAt: jobs.publishedAt,
  createdAt: jobs.createdAt,
  company: {
    id: companies.id,
    name: companies.name,
    countryCode: companies.countryCode,
  },
};

@Injectable()
export class JobsService {
  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase,
    @Inject(DB_TX) private readonly dbTx: NeonDatabase,
    private readonly skillsService: SkillsService,
  ) {}

  async list(query: ListJobsQueryDto): Promise<{
    items: JobListItem[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const conditions = [eq(jobs.status, 'published')];

    if (query.search) {
      conditions.push(ilike(jobs.title, `%${query.search}%`));
    }
    if (query.country) {
      conditions.push(eq(companies.countryCode, query.country.toUpperCase()));
    }
    if (query.skills && query.skills.length > 0) {
      // "has at least one of these skills" (OR) — broadens recall for
      // a candidate filtering by their own skill set, rather than
      // requiring every listed skill be present (AND). Not specified
      // in the task; documented here as the deliberate interpretation.
      conditions.push(
        exists(
          this.db
            .select({ jobId: jobSkills.jobId })
            .from(jobSkills)
            .where(
              and(
                eq(jobSkills.jobId, jobs.id),
                inArray(jobSkills.skillId, query.skills),
              ),
            ),
        ),
      );
    }

    const whereClause = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select(LIST_COLUMNS)
        .from(jobs)
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .where(whereClause)
        .orderBy(desc(jobs.publishedAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ total: count() })
        .from(jobs)
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .where(whereClause),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async getById(
    jobId: string,
    viewer?: { userId: string; role: string },
  ): Promise<JobDetail> {
    const [job] = await this.db
      .select({
        ...LIST_COLUMNS,
        description: jobs.description,
        status: jobs.status,
        companyId: jobs.companyId,
      })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobs.id, jobId));

    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    if (job.status !== 'published') {
      const ownedCompanyId =
        viewer?.role === 'employer'
          ? await this.getUserCompanyId(viewer.userId)
          : null;
      if (!ownedCompanyId || ownedCompanyId !== job.companyId) {
        // Same 404 as "doesn't exist" — a draft/closed job is
        // invisible to everyone except the owning employer.
        throw new NotFoundException('Job not found.');
      }
    }

    return {
      id: job.id,
      title: job.title,
      description: job.description,
      status: job.status,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      timezoneAnchor: job.timezoneAnchor,
      timezoneOverlapHours: job.timezoneOverlapHours,
      publishedAt: job.publishedAt,
      createdAt: job.createdAt,
      company: job.company,
      skills: await this.getSkills(jobId),
    };
  }

  async create(userId: string, dto: CreateJobDto): Promise<Job> {
    const companyId = await this.getUserCompanyId(userId);
    if (!companyId) {
      throw new BadRequestException('Create a company before posting jobs.');
    }

    assertSalaryConsistent({
      min: dto.salaryMin,
      max: dto.salaryMax,
      currency: dto.salaryCurrency,
      period: dto.salaryPeriod,
    });
    if (dto.timezoneAnchor !== undefined) {
      this.assertValidTimezone(dto.timezoneAnchor);
    }

    const [inserted] = await this.db
      .insert(jobs)
      .values({
        companyId,
        createdBy: userId,
        title: dto.title,
        description: dto.description,
        salaryMin: dto.salaryMin,
        salaryMax: dto.salaryMax,
        salaryCurrency: dto.salaryCurrency?.toUpperCase(),
        salaryPeriod: dto.salaryPeriod,
        timezoneAnchor: dto.timezoneAnchor,
        timezoneOverlapHours: dto.timezoneOverlapHours,
        // status is never set here — defaults to 'draft' at the DB
        // level (see docs/database-design.md), and this DTO has no
        // status/publishedAt field for a client to smuggle a value in.
      })
      .returning();

    return inserted;
  }

  async update(userId: string, jobId: string, dto: UpdateJobDto): Promise<Job> {
    const existing = await this.assertOwnedJob(userId, jobId);

    const updateValues: Partial<typeof jobs.$inferInsert> = {};
    if (dto.title !== undefined) updateValues.title = dto.title;
    if (dto.description !== undefined)
      updateValues.description = dto.description;
    if (dto.salaryMin !== undefined) updateValues.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) updateValues.salaryMax = dto.salaryMax;
    if (dto.salaryCurrency !== undefined)
      updateValues.salaryCurrency = dto.salaryCurrency.toUpperCase();
    if (dto.salaryPeriod !== undefined)
      updateValues.salaryPeriod = dto.salaryPeriod;
    if (dto.timezoneOverlapHours !== undefined)
      updateValues.timezoneOverlapHours = dto.timezoneOverlapHours;
    if (dto.timezoneAnchor !== undefined) {
      this.assertValidTimezone(dto.timezoneAnchor);
      updateValues.timezoneAnchor = dto.timezoneAnchor;
    }

    assertSalaryConsistent({
      min: updateValues.salaryMin ?? existing.salaryMin ?? undefined,
      max: updateValues.salaryMax ?? existing.salaryMax ?? undefined,
      currency:
        updateValues.salaryCurrency ?? existing.salaryCurrency ?? undefined,
      period: updateValues.salaryPeriod ?? existing.salaryPeriod ?? undefined,
    });

    if (Object.keys(updateValues).length === 0) {
      return existing;
    }

    const [updated] = await this.db
      .update(jobs)
      .set(updateValues)
      .where(eq(jobs.id, jobId))
      .returning();
    return updated;
  }

  // Sets status and published_at together — the DB CHECK
  // (jobs_published_requires_published_at) would reject one without
  // the other anyway, but doing both here means the API never even
  // attempts the invalid combination.
  async publish(userId: string, jobId: string): Promise<Job> {
    await this.assertOwnedJob(userId, jobId);
    const [updated] = await this.db
      .update(jobs)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();
    return updated;
  }

  async close(userId: string, jobId: string): Promise<Job> {
    await this.assertOwnedJob(userId, jobId);
    const [updated] = await this.db
      .update(jobs)
      .set({ status: 'closed' })
      .where(eq(jobs.id, jobId))
      .returning();
    return updated;
  }

  async replaceSkills(
    userId: string,
    jobId: string,
    skillIds: string[],
  ): Promise<JobSkillSummary[]> {
    await this.assertOwnedJob(userId, jobId);

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

    // Real transaction (see db/db.module.ts DB_TX) — same reasoning as
    // candidates' replaceSkills.
    await this.dbTx.transaction(async (tx) => {
      await tx.delete(jobSkills).where(eq(jobSkills.jobId, jobId));
      if (uniqueIds.length > 0) {
        await tx
          .insert(jobSkills)
          .values(uniqueIds.map((skillId) => ({ jobId, skillId })));
      }
    });

    return this.getSkills(jobId);
  }

  async getSkills(jobId: string): Promise<JobSkillSummary[]> {
    return this.db
      .select({ id: skills.id, slug: skills.slug, name: skills.name })
      .from(jobSkills)
      .innerJoin(skills, eq(jobSkills.skillId, skills.id))
      .where(eq(jobSkills.jobId, jobId))
      .orderBy(skills.name);
  }

  // Public: reused by applications module (job must be published to
  // accept applications) — never confirms whether a non-published job
  // exists, same 404 either way.
  async assertJobIsPublished(jobId: string): Promise<Job> {
    const job = await this.findJob(jobId);
    if (!job || job.status !== 'published') {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }

  // Public: reused by applications module for GET /jobs/:id/applications
  // and PATCH /applications/:id ownership checks. A user with no
  // company (companyId null) can never match a job's (NOT NULL)
  // company_id, so this also covers "publishing requires a company"
  // without a separate check — see report.
  async assertOwnedJob(userId: string, jobId: string): Promise<Job> {
    const [companyId, job] = await Promise.all([
      this.getUserCompanyId(userId),
      this.findJob(jobId),
    ]);
    if (!job || !companyId || job.companyId !== companyId) {
      throw new NotFoundException('Job not found.');
    }
    return job;
  }

  // Public: batch job-summary lookup for applications module's "my
  // applications" list — avoids N+1 queries and avoids applications
  // module importing the jobs/companies schema tables directly.
  async getJobSummaries(
    jobIds: string[],
  ): Promise<
    { id: string; title: string; companyId: string; companyName: string }[]
  > {
    if (jobIds.length === 0) return [];
    return this.db
      .select({
        id: jobs.id,
        title: jobs.title,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(jobs)
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(inArray(jobs.id, jobIds));
  }

  private async findJob(jobId: string): Promise<Job | undefined> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    return job;
  }

  private async getUserCompanyId(userId: string): Promise<string | null> {
    const [user] = await this.db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, userId));
    return user?.companyId ?? null;
  }

  private assertValidTimezone(timezone: string): void {
    if (!isValidTimezone(timezone)) {
      throw new BadRequestException(
        `'${timezone}' is not a valid IANA timezone name.`,
      );
    }
  }
}
