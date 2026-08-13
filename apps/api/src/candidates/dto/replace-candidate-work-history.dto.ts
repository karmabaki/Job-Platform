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

export class CandidateWorkHistoryItemDto extends DateRangeItemDto {
  @IsString()
  @MinLength(1)
  roleTitle: string;

  // Optional — an NDA'd employer has no public company name to give.
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReplaceCandidateWorkHistoryDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CandidateWorkHistoryItemDto)
  // sort_order is derived from array position, not client-supplied.
  items: CandidateWorkHistoryItemDto[];
}
