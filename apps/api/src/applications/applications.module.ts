import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  // Guard classes re-declared as local providers — see
  // candidates.module.ts for why.
  imports: [DbModule, AuthModule, JobsModule, CandidatesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, JwtAuthGuard, RolesGuard],
})
export class ApplicationsModule {}
