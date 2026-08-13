import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DateRangeItemDto } from './date-range-item.dto';

export class CandidateEducationItemDto extends DateRangeItemDto {
  @IsString()
  @MinLength(1)
  institutionName: string;

  @IsOptional()
  @IsString()
  degree?: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  // Thesis, honors, coursework, etc. — see docs/database-design.md
  // Open question #10 (resolved).
  @IsOptional()
  @IsString()
  description?: string;
}

export class ReplaceCandidateEducationDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CandidateEducationItemDto)
  // sort_order is derived from array position, not client-supplied.
  items: CandidateEducationItemDto[];
}
