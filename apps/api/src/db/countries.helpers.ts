import { BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { countries } from './countries';

type MarketFlag = 'candidateAllowed' | 'employerAllowed';

// Shared by candidates and employers modules — country_code must both
// exist and have the relevant market flag set. See
// docs/database-design.md Key decision #7: the countries table holds
// the full ISO list so the FK never fails on a real country; market
// availability is a data flag checked here, not a schema constraint.
export async function assertCountryAllowed(
  db: NeonHttpDatabase,
  rawCountryCode: string,
  flag: MarketFlag,
  audience: 'candidates' | 'employers',
): Promise<string> {
  const code = rawCountryCode.toUpperCase();
  const [country] = await db
    .select()
    .from(countries)
    .where(eq(countries.code, code));

  if (!country) {
    throw new BadRequestException(
      `Country '${code}' is not a recognized country code.`,
    );
  }
  if (!country[flag]) {
    throw new BadRequestException(
      `Country '${country.name}' (${code}) is not currently available for ${audience}.`,
    );
  }
  return code;
}
