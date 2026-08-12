import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmployersController } from './employers.controller';
import { EmployersService } from './employers.service';

@Module({
  // See candidates.module.ts for why JwtAuthGuard/RolesGuard are
  // re-declared here despite AuthModule already providing them.
  imports: [DbModule, AuthModule],
  controllers: [EmployersController],
  providers: [EmployersService, JwtAuthGuard, RolesGuard],
})
export class EmployersModule {}
