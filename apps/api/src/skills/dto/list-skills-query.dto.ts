import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSkillsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
