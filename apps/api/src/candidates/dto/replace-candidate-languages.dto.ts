import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

const PROFICIENCY_VALUES = [
  'basic',
  'conversational',
  'professional',
  'fluent',
  'native',
] as const;
export type Proficiency = (typeof PROFICIENCY_VALUES)[number];

export class CandidateLanguageItemDto {
  // Format only — actually validated as a real ISO 639-1 code in the
  // service (see common/is-valid-language-code.ts), not trusted as-is.
  @IsString()
  @Length(2, 2)
  languageCode: string;

  @IsIn(PROFICIENCY_VALUES)
  proficiency: Proficiency;
}

export class ReplaceCandidateLanguagesDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CandidateLanguageItemDto)
  languages: CandidateLanguageItemDto[];
}
