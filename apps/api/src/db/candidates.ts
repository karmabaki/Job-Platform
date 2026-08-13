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
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: 'restrict' }),
    timezone: text('timezone').notNull(),
    availability: text('availability').notNull(),
    salaryExpectationMin: integer('salary_expectation_min'),
    salaryExpectationMax: integer('salary_expectation_max'),
    salaryCurrency: char('salary_currency', { length: 3 }),
    salaryPeriod: text('salary_period'),
    // Career-wide total — a different question from
    // candidate_skills.years_experience (per-skill); both are kept
    // (Phase 4.5).
    totalYearsExperience: smallint('total_years_experience'),
    profileCompleteness: smallint('profile_completeness').notNull().default(0),
    isSearchable: boolean('is_searchable').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_profiles_country_code_idx').on(table.countryCode),
    index('candidate_profiles_availability_idx').on(table.availability),
    check(
      'candidate_profiles_availability_check',
      sql`${table.availability} IN ('full_time','part_time','contract')`,
    ),
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
    check(
      'candidate_profiles_total_years_experience_check',
      sql`${table.totalYearsExperience} IS NULL OR (${table.totalYearsExperience} >= 0 AND ${table.totalYearsExperience} <= 60)`,
    ),
    check(
      'candidate_profiles_completeness_check',
      sql`${table.profileCompleteness} BETWEEN 0 AND 100`,
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.candidateId, table.skillId] }),
    index('candidate_skills_skill_id_idx').on(table.skillId),
  ],
);

export const candidateLanguages = pgTable(
  'candidate_languages',
  {
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.userId, { onDelete: 'cascade' }),
    languageCode: char('language_code', { length: 2 }).notNull(),
    proficiency: text('proficiency').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.candidateId, table.languageCode] }),
    check(
      'candidate_languages_proficiency_check',
      sql`${table.proficiency} IN ('basic','conversational','professional','fluent','native')`,
    ),
  ],
);

export const candidatePortfolioItems = pgTable(
  'candidate_portfolio_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.userId, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    url: text('url'),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_portfolio_items_candidate_sort_idx').on(
      table.candidateId,
      table.sortOrder,
    ),
  ],
);

export const candidateWorkHistory = pgTable(
  'candidate_work_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.userId, { onDelete: 'cascade' }),
    roleTitle: text('role_title').notNull(),
    companyName: text('company_name'),
    description: text('description'),
    startYear: smallint('start_year').notNull(),
    startMonth: smallint('start_month'),
    endYear: smallint('end_year'),
    endMonth: smallint('end_month'),
    isCurrent: boolean('is_current').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_work_history_candidate_sort_idx').on(
      table.candidateId,
      table.sortOrder,
    ),
    check(
      'candidate_work_history_start_year_check',
      sql`${table.startYear} BETWEEN 1950 AND 2100`,
    ),
    check(
      'candidate_work_history_start_month_check',
      sql`${table.startMonth} IS NULL OR ${table.startMonth} BETWEEN 1 AND 12`,
    ),
    check(
      'candidate_work_history_end_month_check',
      sql`${table.endMonth} IS NULL OR ${table.endMonth} BETWEEN 1 AND 12`,
    ),
    check(
      'candidate_work_history_current_no_end_check',
      sql`${table.isCurrent} = false OR (${table.endYear} IS NULL AND ${table.endMonth} IS NULL)`,
    ),
    check(
      'candidate_work_history_end_after_start_year_check',
      sql`${table.endYear} IS NULL OR ${table.endYear} >= ${table.startYear}`,
    ),
    check(
      'candidate_work_history_end_after_start_month_check',
      sql`${table.endYear} IS NULL OR ${table.endYear} > ${table.startYear} OR ${table.endMonth} IS NULL OR ${table.startMonth} IS NULL OR ${table.endMonth} >= ${table.startMonth}`,
    ),
  ],
);

export const candidateEducation = pgTable(
  'candidate_education',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidateProfiles.userId, { onDelete: 'cascade' }),
    institutionName: text('institution_name').notNull(),
    degree: text('degree'),
    fieldOfStudy: text('field_of_study'),
    description: text('description'),
    startYear: smallint('start_year').notNull(),
    startMonth: smallint('start_month'),
    endYear: smallint('end_year'),
    endMonth: smallint('end_month'),
    isCurrent: boolean('is_current').notNull().default(false),
    sortOrder: smallint('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('candidate_education_candidate_sort_idx').on(
      table.candidateId,
      table.sortOrder,
    ),
    check(
      'candidate_education_start_year_check',
      sql`${table.startYear} BETWEEN 1950 AND 2100`,
    ),
    check(
      'candidate_education_start_month_check',
      sql`${table.startMonth} IS NULL OR ${table.startMonth} BETWEEN 1 AND 12`,
    ),
    check(
      'candidate_education_end_month_check',
      sql`${table.endMonth} IS NULL OR ${table.endMonth} BETWEEN 1 AND 12`,
    ),
    check(
      'candidate_education_current_no_end_check',
      sql`${table.isCurrent} = false OR (${table.endYear} IS NULL AND ${table.endMonth} IS NULL)`,
    ),
    check(
      'candidate_education_end_after_start_year_check',
      sql`${table.endYear} IS NULL OR ${table.endYear} >= ${table.startYear}`,
    ),
    check(
      'candidate_education_end_after_start_month_check',
      sql`${table.endYear} IS NULL OR ${table.endYear} > ${table.startYear} OR ${table.endMonth} IS NULL OR ${table.startMonth} IS NULL OR ${table.endMonth} >= ${table.startMonth}`,
    ),
  ],
);
