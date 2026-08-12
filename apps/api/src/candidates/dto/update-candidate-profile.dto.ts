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
import type {
  Availability,
  SalaryPeriod,
} from './create-candidate-profile.dto';

const AVAILABILITY_VALUES = ['full_time', 'part_time', 'contract'] as const;
const SALARY_PERIOD_VALUES = ['yearly', 'monthly', 'hourly'] as const;

// All fields optional (PATCH semantics) — written out explicitly
// rather than deriving from CreateCandidateProfileDto with a
// PartialType helper, to avoid adding @nestjs/mapped-types as a new
// dependency for one small DTO.
export class UpdateCandidateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

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

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  timezone?: string;

  @IsOptional()
  @IsIn(AVAILABILITY_VALUES)
  availability?: Availability;

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
