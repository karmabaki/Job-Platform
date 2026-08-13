// Deliberately NOT Intl.supportedValuesOf('timeZone') — tested and
// confirmed it only lists canonical names and misses some real,
// commonly-used IANA names still valid as aliases (e.g. it excludes
// "Asia/Kolkata", the current canonical name, listing only the older
// "Asia/Calcutta"). Intl.DateTimeFormat's own constructor validates
// against ICU's full zone + alias table instead, which is what
// everything else that actually formats a date with this value will
// use anyway — so this is both more complete and more representative
// of what "valid" means here.
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
