import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CandidatePortfolioItemDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Optional — private/NDA'd work has no public link (matches the
  // schema's rationale for a nullable url column).
  @IsOptional()
  @IsUrl()
  url?: string;
}

export class ReplaceCandidatePortfolioDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CandidatePortfolioItemDto)
  // sort_order is derived from array position, not client-supplied —
  // submit items in the order they should display.
  items: CandidatePortfolioItemDto[];
}
