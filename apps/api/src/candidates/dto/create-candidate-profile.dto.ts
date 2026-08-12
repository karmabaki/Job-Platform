import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  MinLength,
} from 'class-validator';

const AVAILABILITY_VALUES = ['full_time', 'part_time', 'contract'] as const;
const SALARY_PERIOD_VALUES = ['yearly', 'monthly', 'hourly'] as const;

export type Availability = (typeof AVAILABILITY_VALUES)[number];
export type SalaryPeriod = (typeof SALARY_PERIOD_VALUES)[number];

export class CreateCandidateProfileDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;

  // Format only — existence and market availability are checked
  // against the countries table in the service, not here.
  @IsString()
  @Length(2, 2)
  countryCode: string;

  // Format only — validated against the IANA tz database in the
  // service (see is-valid-timezone.ts), not trusted as-is.
  @IsString()
  @MinLength(1)
  timezone: string;

  @IsIn(AVAILABILITY_VALUES)
  availability: Availability;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryExpectationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryExpectationMax?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string;

  @IsOptional()
  @IsIn(SALARY_PERIOD_VALUES)
  salaryPeriod?: SalaryPeriod;
}
