import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const SALARY_PERIOD_VALUES = ['yearly', 'monthly', 'hourly'] as const;
export type SalaryPeriod = (typeof SALARY_PERIOD_VALUES)[number];

// Deliberately no `status` or `publishedAt` field — combined with the
// global ValidationPipe's forbidNonWhitelisted, a client that sends
// either gets a 400 automatically. Status is always 'draft' on
// create; publishing is a separate, dedicated endpoint (POST
// /jobs/:id/publish) so status and published_at can never drift apart.
export class CreateJobDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  salaryCurrency?: string;

  @IsOptional()
  @IsIn(SALARY_PERIOD_VALUES)
  salaryPeriod?: SalaryPeriod;

  // Format only — validated against the IANA tz database in the
  // service, same as candidates.timezone.
  @IsOptional()
  @IsString()
  @MinLength(1)
  timezoneAnchor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24)
  timezoneOverlapHours?: number;
}
