import { pgTable, char, text, unique } from 'drizzle-orm/pg-core';

export const countries = pgTable(
  'countries',
  {
    code: char('code', { length: 2 }).primaryKey(),
    name: text('name').notNull(),
  },
  (table) => [unique('countries_name_unique').on(table.name)],
);
