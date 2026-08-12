import {
  pgTable,
  uuid,
  text,
  char,
  integer,
  smallint,
  boolean,
  timestamp,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies';
import { users } from './users';
import { skills } from './skills';

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull().default('draft'),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: char('salary_currency', { length: 3 }),
    salaryPeriod: text('salary_period'),
    timezoneAnchor: text('timezone_anchor'),
    timezoneOverlapHours: smallint('timezone_overlap_hours'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('jobs_company_id_idx').on(table.companyId),
    index('jobs_status_published_at_idx').on(
      table.status,
      table.publishedAt.desc(),
    ),
    index('jobs_created_by_idx').on(table.createdBy),
    check(
      'jobs_status_check',
      sql`${table.status} IN ('draft','published','closed')`,
    ),
    check(
      'jobs_salary_period_check',
      sql`${table.salaryPeriod} IS NULL OR ${table.salaryPeriod} IN ('yearly','monthly','hourly')`,
    ),
    check(
      'jobs_salary_min_nonnegative',
      sql`${table.salaryMin} IS NULL OR ${table.salaryMin} >= 0`,
    ),
    check(
      'jobs_salary_max_gte_min',
      sql`${table.salaryMin} IS NULL OR ${table.salaryMax} IS NULL OR ${table.salaryMax} >= ${table.salaryMin}`,
    ),
    check(
      'jobs_salary_currency_period_required',
      sql`(${table.salaryMin} IS NULL AND ${table.salaryMax} IS NULL) OR (${table.salaryCurrency} IS NOT NULL AND ${table.salaryPeriod} IS NOT NULL)`,
    ),
    check(
      'jobs_published_requires_published_at',
      sql`${table.status} <> 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
  ],
);

export const jobSkills = pgTable(
  'job_skills',
  {
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    isRequired: boolean('is_required').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.jobId, table.skillId] }),
    index('job_skills_skill_id_idx').on(table.skillId),
  ],
);
