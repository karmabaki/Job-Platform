import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  // Deliberately no @MinLength here — a too-short password should fail
  // for the exact same reason and via the exact same generic error as
  // any other wrong password, not a different (400) validation error.
  @IsString()
  @IsNotEmpty()
  password: string;
}
