import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  password: string;

  // Explicit runtime rejection of anything but these two values —
  // 'admin' (or any other string) is impossible to register through
  // this DTO, not merely absent from the TS type.
  @IsIn(['candidate', 'employer'])
  role: 'candidate' | 'employer';
}
