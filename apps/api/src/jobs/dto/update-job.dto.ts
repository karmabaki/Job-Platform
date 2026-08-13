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
import type { SalaryPeriod } from './create-job.dto';

const SALARY_PERIOD_VALUES = ['yearly', 'monthly', 'hourly'] as const;

// All fields optional (PATCH semantics), and — critically — no
// `status` or `published_at` here either. See create-job.dto.ts for
// why; PATCH must not be able to change status, only the dedicated
// publish/close endpoints can.
export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

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
