const POSTGRES_UNIQUE_VIOLATION = '23505';

// drizzle-orm wraps the driver's error as DrizzleQueryError, with the
// actual Postgres error (carrying `.code`) nested one level down as
// `.cause` — the code never appears on the outer error directly (same
// finding as auth.service.ts's private copy of this logic; duplicated
// here rather than importing from auth to keep modules independent —
// see report for why this wasn't also refactored into auth.service.ts).
export function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === POSTGRES_UNIQUE_VIOLATION;
}

function getPgErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  return getPgErrorCode((err as { cause?: unknown }).cause);
}
