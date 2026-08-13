import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DbModule } from '../db/db.module';
import { requireEnv } from '../env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { SESSION_TTL_SECONDS } from './constants';

// registerAsync + useFactory defers reading JWT_SECRET until Nest
// actually resolves this provider (inside NestFactory.create()), not
// at module-decoration/import time — that's what guarantees
// main.ts's env-file load has already run by the time this executes.
const jwtModule = JwtModule.registerAsync({
  useFactory: () => ({
    secret: requireEnv('JWT_SECRET'),
    signOptions: { expiresIn: SESSION_TTL_SECONDS },
  }),
});

// Global: JwtAuthGuard/RolesGuard are applied via @UseGuards(ClassRef)
// in every feature module (candidates, employers, ...), and each of
// those modules also re-declares them as local providers (see
// candidates.module.ts). Both of those need JwtService reachable —
// which requires re-exporting jwtModule itself here, not just the
// guard classes (confirmed by testing: exporting only the guards left
// JwtService unresolvable, since @Global() only broadens what a
// module's *own* `exports` array reaches, and JwtService was never in
// it until now).
@Global()
@Module({
  imports: [DbModule, jwtModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, OptionalJwtAuthGuard],
  exports: [jwtModule, JwtAuthGuard, RolesGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
