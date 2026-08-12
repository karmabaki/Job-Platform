import {
  pgTable,
  uuid,
  text,
  char,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { countries } from './countries';

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    website: text('website'),
    countryCode: char('country_code', { length: 2 })
      .notNull()
      .references(() => countries.code, { onDelete: 'restrict' }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('companies_country_code_idx').on(table.countryCode)],
);
