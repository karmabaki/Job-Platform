import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  // Format only — existence and market availability are checked
  // against the countries table in the service, not here.
  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsOptional()
  @IsString()
  description?: string;
}
