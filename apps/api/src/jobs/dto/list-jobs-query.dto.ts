import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // Comma-separated skill ids, e.g. ?skills=id1,id2 — parsed here so
  // the service only ever deals with a clean string[]. Each id's
  // format (UUID) isn't re-validated here; an id that matches nothing
  // just filters out all results, same as any other no-match filter.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsString({ each: true })
  skills?: string[];

  // Format only (ISO 3166-1 alpha-2 is always 2 letters) — existence
  // is checked once, server-side, against the countries table, same
  // as everywhere else in this app that takes a country code.
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(0)
  offset: number = 0;
}
