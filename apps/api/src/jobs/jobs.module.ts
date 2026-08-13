import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  // Guard classes re-declared as local providers — see
  // candidates.module.ts for why (Nest's @UseGuards(ClassRef)
  // resolves the guard's own dependencies via the consuming module,
  // not the module that originally provided it).
  imports: [DbModule, SkillsModule, AuthModule],
  controllers: [JobsController],
  providers: [JobsService, JwtAuthGuard, RolesGuard, OptionalJwtAuthGuard],
  // Exported for the applications module (assertOwnedJob,
  // assertJobIsPublished, getJobSummaries).
  exports: [JobsService],
})
export class JobsModule {}
