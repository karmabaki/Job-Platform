import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DbModule } from '../db/db.module';
import { requireEnv } from '../env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SESSION_TTL_SECONDS } from './constants';

@Module({
  imports: [
    DbModule,
    // registerAsync + useFactory defers reading JWT_SECRET until Nest
    // actually resolves this provider (inside NestFactory.create()),
    // not at module-decoration/import time — that's what guarantees
    // main.ts's env-file load has already run by the time this executes.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requireEnv('JWT_SECRET'),
        signOptions: { expiresIn: SESSION_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
