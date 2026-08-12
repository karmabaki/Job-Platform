import { pgTable, char, text, boolean, unique } from 'drizzle-orm/pg-core';

export const countries = pgTable(
  'countries',
  {
    code: char('code', { length: 2 }).primaryKey(),
    name: text('name').notNull(),
    candidateAllowed: boolean('candidate_allowed').notNull().default(false),
    employerAllowed: boolean('employer_allowed').notNull().default(false),
  },
  (table) => [unique('countries_name_unique').on(table.name)],
);
