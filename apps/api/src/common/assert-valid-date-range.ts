import { BadRequestException } from '@nestjs/common';

export interface DateRangeFields {
  startYear: number;
  startMonth?: number | null;
  endYear?: number | null;
  endMonth?: number | null;
  isCurrent?: boolean;
}

// Mirrors the four cross-field CHECK constraints shared by
// candidate_work_history and candidate_education (see
// docs/database-design.md) — validated here too so the user gets a
// readable error instead of a raw constraint violation.
export function assertValidDateRange(
  entry: DateRangeFields,
  label: string,
): void {
  const { startYear, startMonth, endYear, endMonth, isCurrent } = entry;

  if (isCurrent && (endYear != null || endMonth != null)) {
    throw new BadRequestException(
      `${label}: a current entry cannot have an end date.`,
    );
  }
  if (endYear != null && endYear < startYear) {
    throw new BadRequestException(
      `${label}: end year cannot be before start year.`,
    );
  }
  if (
    endYear != null &&
    endYear === startYear &&
    endMonth != null &&
    startMonth != null &&
    endMonth < startMonth
  ) {
    throw new BadRequestException(
      `${label}: end month cannot be before start month in the same year.`,
    );
  }
}
