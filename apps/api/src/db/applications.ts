import { pgTable, uuid, text, integer, smallint, char, timestamp, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { jobs } from './jobs';
import { candidateProfiles } from './candidates';

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.userId, { onDelete: 'cascade' }),
    status: text('status').notNull().default('applied'),
    coverNote: text('cover_note'),
    hiredAt: timestamp('hired_at', { withTimezone: true }),
    agreedRateAmount: integer('agreed_rate_amount'),
    agreedRateCurrency: char('agreed_rate_currency', { length: 3 }),
    engagementType: text('engagement_type'),
    engagementMonths: smallint('engagement_months'),
    placementFeeAmount: integer('placement_fee_amount'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('applications_job_candidate_unique').on(table.jobId, table.candidateId),
    index('applications_candidate_id_idx').on(table.candidateId),
    index('applications_job_id_status_idx').on(table.jobId, table.status),
    check('applications_status_check', sql`${table.status} IN ('applied','shortlisted','rejected','hired')`),
    check(
      'applications_engagement_type_check',
      sql`${table.engagementType} IS NULL OR ${table.engagementType} IN ('permanent','fixed_term')`,
    ),
    check('applications_engagement_months_check', sql`${table.engagementMonths} IS NULL OR ${table.engagementMonths} >= 6`),
    check(
      'applications_agreed_rate_currency_required',
      sql`${table.agreedRateAmount} IS NULL OR ${table.agreedRateCurrency} IS NOT NULL`,
    ),
    check('applications_hired_requires_hired_at', sql`${table.status} <> 'hired' OR ${table.hiredAt} IS NOT NULL`),
  ],
);
