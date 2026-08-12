import {
  pgTable,
  uuid,
  text,
  char,
  integer,
  smallint,
  timestamp,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { countries } from './countries';
import { skills } from './skills';

export const candidateProfiles = pgTable(
  'candidate_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    headline: text('headline'),
    bio: text('bio'),
    githubUrl: text('github_url'),
    portfolioUrl: text('portfolio_url'),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: 'restrict' }),
    timezone: text('timezone').notNull(),
    availability: text('availability').notNull(),
    salaryExpectationMin: integer('salary_expectation_min'),
    salaryExpectationMax: integer('salary_expectation_max'),
    salaryCurrency: char('salary_currency', { length: 3 }),
    salaryPeriod: text('salary_period'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_profiles_country_code_idx').on(table.countryCode),
    index('candidate_profiles_availability_idx').on(table.availability),
    check('candidate_profiles_availability_check', sql`${table.availability} IN ('full_time','part_time','contract')`),
    check(
      'candidate_profiles_salary_period_check',
      sql`${table.salaryPeriod} IS NULL OR ${table.salaryPeriod} IN ('yearly','monthly','hourly')`,
    ),
    check(
      'candidate_profiles_salary_min_nonnegative',
      sql`${table.salaryExpectationMin} IS NULL OR ${table.salaryExpectationMin} >= 0`,
    ),
    check(
      'candidate_profiles_salary_max_gte_min',
      sql`${table.salaryExpectationMin} IS NULL OR ${table.salaryExpectationMax} IS NULL OR ${table.salaryExpectationMax} >= ${table.salaryExpectationMin}`,
    ),
    check(
      'candidate_profiles_salary_currency_period_required',
      sql`(${table.salaryExpectationMin} IS NULL AND ${table.salaryExpectationMax} IS NULL) OR (${table.salaryCurrency} IS NOT NULL AND ${table.salaryPeriod} IS NOT NULL)`,
    ),
  ],
);

export const candidateSkills = pgTable(
  'candidate_skills',
  {
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.userId, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    yearsExperience: smallint('years_experience'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.candidateId, table.skillId] }),
    index('candidate_skills_skill_id_idx').on(table.skillId),
  ],
);
