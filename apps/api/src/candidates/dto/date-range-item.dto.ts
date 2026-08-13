import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

// Shared base for work-history and education items — same date shape,
// same format-level bounds. Cross-field rules (is_current implies no
// end date, end >= start, month ordering within the same year) can't
// be expressed with simple per-property decorators, so those are
// checked in the service via common/assert-valid-date-range.ts instead.
export class DateRangeItemDto {
  @IsInt()
  @Min(1950)
  @Max(2100)
  startYear: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  endYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth?: number;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
