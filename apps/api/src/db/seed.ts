import path from 'node:path';
import process from 'node:process';

process.loadEnvFile(path.resolve(__dirname, '../../.env'));

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql, inArray, eq, count } from 'drizzle-orm';
import { getNames } from 'i18n-iso-countries';
import { countries } from './countries';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in apps/api/.env');
}

const client = neon(process.env.DATABASE_URL);
const db = drizzle(client);

async function seedCountries() {
  const names = getNames('en');
  const rows = Object.entries(names).map(([code, name]) => ({ code, name }));

  // Upsert: on conflict, only touch `name`. This never resets
  // candidate_allowed/employer_allowed on rows that already exist —
  // that's what makes re-running this script safe.
  await db
    .insert(countries)
    .values(rows)
    .onConflictDoUpdate({
      target: countries.code,
      set: { name: sql`excluded.name` },
    });

  return rows.length;
}

// --- Initial market flags ---
// Supply markets are selected for developer salaries broadly under
// ~$1500/month; demand markets for broadly above ~$3000/month.
// Comprehensively sanctioned jurisdictions (CU IR KP SY) and
// targeted-sanction jurisdictions (RU BY VE MM NI) are deliberately
// excluded from both lists.
const CANDIDATE_ALLOWED_CODES = [
  'IN',
  'PK',
  'BD',
  'LK',
  'NP',
  'VN',
  'PH',
  'ID',
  'KH',
  'EG',
  'MA',
  'TN',
  'JO',
  'DZ',
  'NG',
  'KE',
  'GH',
  'RW',
  'UG',
  'TZ',
  'RS',
  'MK',
  'AL',
  'BA',
  'ME',
  'MD',
  'GE',
  'AM',
  'AZ',
  'UZ',
  'KZ',
  'KG',
  'AR',
  'CO',
  'PE',
  'BO',
  'EC',
  'PY',
  'GT',
  'HN',
  'SV',
  'DO',
  'TR',
];

const EMPLOYER_ALLOWED_CODES = [
  'US',
  'CA',
  'GB',
  'IE',
  'DE',
  'NL',
  'FR',
  'BE',
  'LU',
  'AT',
  'CH',
  'DK',
  'SE',
  'NO',
  'FI',
  'IS',
  'ES',
  'IT',
  'PT',
  'PL',
  'CZ',
  'EE',
  'LT',
  'SI',
  'SK',
  'HU',
  'AU',
  'NZ',
  'SG',
  'JP',
  'KR',
  'HK',
  'IL',
  'AE',
  'SA',
  'QA',
  'KW',
  'BH',
  'OM',
];

async function setInitialMarketFlags() {
  await db
    .update(countries)
    .set({ candidateAllowed: true })
    .where(inArray(countries.code, CANDIDATE_ALLOWED_CODES));
  await db
    .update(countries)
    .set({ employerAllowed: true })
    .where(inArray(countries.code, EMPLOYER_ALLOWED_CODES));
}

async function main() {
  const seededCount = await seedCountries();
  await setInitialMarketFlags();

  const [{ total }] = await db.select({ total: count() }).from(countries);
  const [{ candidateAllowedCount }] = await db
    .select({ candidateAllowedCount: count() })
    .from(countries)
    .where(eq(countries.candidateAllowed, true));
  const [{ employerAllowedCount }] = await db
    .select({ employerAllowedCount: count() })
    .from(countries)
    .where(eq(countries.employerAllowed, true));

  console.log(`Upserted ${seededCount} country rows.`);
  console.log(`Total countries: ${total}`);
  console.log(`candidate_allowed = true: ${candidateAllowedCount}`);
  console.log(`employer_allowed = true: ${employerAllowedCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
