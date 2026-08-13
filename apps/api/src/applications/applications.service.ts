import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../db/db.module';
import { applications } from '../db/applications';
import { isUniqueViolation } from '../db/pg-errors';
import { JobsService } from '../jobs/jobs.service';
import {
  CandidatesService,
  EmployerVisibleCandidateProfile,
} from '../candidates/candidates.service';
import type { CandidateSkillSummary } from '../candidates/candidates.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

export interface CandidateApplicationView {
  id: string;
  status: string;
  coverNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  hiredAt: Date | null;
  job: {
    id: string;
    title: string;
    company: { id: string; name: string };
  };
}

// Deliberately no candidateId/userId anywhere in here — see
// EmployerVisibleCandidateProfile in candidates.service.ts.
export interface EmployerApplicationView {
  id: string;
  status: string;
  coverNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  hiredAt: Date | null;
  agreedRateAmount: number | null;
  agreedRateCurrency: string | null;
  engagementType: string | null;
  engagementMonths: number | null;
  placementFeeAmount: number | null;
  candidate:
    | (EmployerVisibleCandidateProfile & { skills: CandidateSkillSummary[] })
    | null;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase,
    private readonly jobsService: JobsService,
    private readonly candidatesService: CandidatesService,
  ) {}

  async apply(
    candidateUserId: string,
    jobId: string,
    dto: CreateApplicationDto,
  ) {
    // Same 404 whether the job doesn't exist or is draft/closed —
    // don't confirm a non-published job's existence to a candidate.
    await this.jobsService.assertJobIsPublished(jobId);

    const hasProfile = await this.candidatesService.hasProfile(candidateUserId);
    if (!hasProfile) {
      throw new BadRequestException(
        'Create a candidate profile before applying to jobs.',
      );
    }

    try {
      const [application] = await this.db
        .insert(applications)
        .values({
          jobId,
          candidateId: candidateUserId,
          coverNote: dto.coverNote,
        })
        .returning({
          id: applications.id,
          status: applications.status,
          coverNote: applications.coverNote,
          createdAt: applications.createdAt,
        });
      return application;
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Backed by applications_job_candidate_unique — one
        // application per (job, candidate) pair.
        throw new ConflictException('You have already applied to this job.');
      }
      throw err;
    }
  }

  // Scoped by candidateId = candidateUserId in the query itself, so
  // there's no id parameter a caller could use to request someone
  // else's applications — this endpoint only ever returns "mine".
  async getOwnApplications(
    candidateUserId: string,
  ): Promise<CandidateApplicationView[]> {
    const rows = await this.db
      .select()
      .from(applications)
      .where(eq(applications.candidateId, candidateUserId))
      .orderBy(desc(applications.createdAt));

    if (rows.length === 0) return [];

    const jobIds = [...new Set(rows.map((r) => r.jobId))];
    const jobById = new Map(
      (await this.jobsService.getJobSummaries(jobIds)).map((j) => [j.id, j]),
    );

    return rows.map((r) => {
      // Non-null: applications.jobId is a NOT NULL FK to jobs.id, and
      // this MVP has no job-delete path, so the summary always exists.
      const job = jobById.get(r.jobId)!;
      return {
        id: r.id,
        status: r.status,
        coverNote: r.coverNote,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        hiredAt: r.hiredAt,
        job: {
          id: job.id,
          title: job.title,
          company: { id: job.companyId, name: job.companyName },
        },
      };
    });
  }

  // Ownership: assertOwnedJob throws 404 for a job that doesn't
  // exist OR belongs to another company — an employer can never
  // confirm another company's job exists via this endpoint.
  async getJobApplications(
    employerUserId: string,
    jobId: string,
  ): Promise<EmployerApplicationView[]> {
    await this.jobsService.assertOwnedJob(employerUserId, jobId);

    const rows = await this.db
      .select()
      .from(applications)
      .where(eq(applications.jobId, jobId))
      .orderBy(desc(applications.createdAt));

    return Promise.all(rows.map((r) => this.toEmployerView(r)));
  }

  async updateStatus(
    employerUserId: string,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<EmployerApplicationView> {
    const [application] = await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId));
    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    try {
      // Ownership: the employer must own the JOB this application
      // belongs to, not the application directly.
      await this.jobsService.assertOwnedJob(employerUserId, application.jobId);
    } catch {
      // Re-thrown with the *same* message as "doesn't exist" above —
      // assertOwnedJob's own "Job not found." would otherwise let a
      // caller distinguish "no such application" from "exists, but
      // not yours" by message text alone, even though both are 404.
      throw new NotFoundException('Application not found.');
    }

    // Setting status='hired' without hired_at would violate
    // applications_hired_requires_hired_at — set both in one update.
    const updateValues: Partial<typeof applications.$inferInsert> = {
      status: dto.status,
    };
    if (dto.status === 'hired') {
      updateValues.hiredAt = new Date();
    }

    const [updated] = await this.db
      .update(applications)
      .set(updateValues)
      .where(eq(applications.id, applicationId))
      .returning();

    return this.toEmployerView(updated);
  }

  private async toEmployerView(
    row: typeof applications.$inferSelect,
  ): Promise<EmployerApplicationView> {
    const [profile, skills] = await Promise.all([
      this.candidatesService.getProfileForEmployerView(row.candidateId),
      this.candidatesService.getSkills(row.candidateId),
    ]);

    return {
      id: row.id,
      status: row.status,
      coverNote: row.coverNote,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      hiredAt: row.hiredAt,
      agreedRateAmount: row.agreedRateAmount,
      agreedRateCurrency: row.agreedRateCurrency,
      engagementType: row.engagementType,
      engagementMonths: row.engagementMonths,
      placementFeeAmount: row.placementFeeAmount,
      candidate: profile ? { ...profile, skills } : null,
    };
  }
}
