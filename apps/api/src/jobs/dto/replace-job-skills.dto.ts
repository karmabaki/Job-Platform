import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceJobSkillsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  skillIds: string[];
}
