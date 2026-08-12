import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as argon2 from 'argon2';
import { DB } from '../db/db.module';
import { users } from '../db/users';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
const GENERIC_REGISTER_ERROR = 'Unable to register with the provided details.';

// Postgres unique_violation error code. Checked instead of a
// pre-insert SELECT so a concurrent duplicate registration can't race
// past an existence check — the database's own unique index on
// lower(email) is the single source of truth for "is this email taken".
const POSTGRES_UNIQUE_VIOLATION = '23505';

// Fixed, precomputed hash of a string nobody will ever type as a real
// password. Verified against on every login where the email doesn't
// exist, so a nonexistent-email attempt costs the same argon2 time as
// a wrong-password attempt — without this, response timing alone would
// let an attacker enumerate registered emails even though the error
// message never differs.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$To5r3D/mx6nWPyqOBPWGgA$p9987w4EkPUwT0XkX951kNP2kgtoliJcVRbjgJyUFR4';

export interface PublicUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; token: string }> {
    const email = dto.email.toLowerCase();
    const passwordHash = await argon2.hash(dto.password);

    let user: PublicUser;
    try {
      const [inserted] = await this.db
        .insert(users)
        .values({ email, passwordHash, role: dto.role })
        .returning({ id: users.id, email: users.email, role: users.role });
      user = inserted;
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Same generic error whether the email was taken or anything
        // else about the request failed at the DB layer — never
        // confirm or deny that an email is already registered.
        throw new BadRequestException(GENERIC_REGISTER_ERROR);
      }
      // Never let the raw driver error propagate: drizzle's
      // DrizzleQueryError carries the full query, including its
      // params — which includes the argon2 hash we just computed.
      // Nest's default exception filter logs uncaught errors verbatim,
      // so re-throwing here would put password_hash in server logs.
      // Log a hash-free message ourselves and throw a clean 500.
      this.logger.error(`User insert failed: ${safeErrorMessage(err)}`);
      throw new InternalServerErrorException(GENERIC_REGISTER_ERROR);
    }

    return { user, token: this.signToken(user) };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; token: string }> {
    const email = dto.email.toLowerCase();
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    const hashToVerify = user?.passwordHash ?? DUMMY_HASH;
    const passwordValid = await argon2
      .verify(hashToVerify, dto.password)
      .catch(() => false);

    if (!user || !passwordValid) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return { user: publicUser, token: this.signToken(publicUser) };
  }

  async me(userId: string): Promise<PublicUser> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new UnauthorizedException('Not authenticated.');
    }

    return user;
  }

  private signToken(user: PublicUser): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}

function isUniqueViolation(err: unknown): boolean {
  return getPgErrorCode(err) === POSTGRES_UNIQUE_VIOLATION;
}

// drizzle-orm wraps the driver's error as DrizzleQueryError, with the
// actual Postgres error (carrying `.code`) nested one level down as
// `.cause` — the code never appears on the outer error directly.
function getPgErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  return getPgErrorCode((err as { cause?: unknown }).cause);
}

// Extracts only `.message` (walking `.cause`, same as getPgErrorCode)
// — deliberately never touches `.params`, `.query`, or any other field
// that could carry the argon2 hash from a failed insert.
function safeErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) return String(err);
  const message = (err as { message?: unknown }).message;
  const cause = (err as { cause?: unknown }).cause;
  const causeMessage =
    cause !== undefined ? ` | cause: ${safeErrorMessage(cause)}` : '';
  return `${typeof message === 'string' ? message : 'unknown error'}${causeMessage}`;
}
