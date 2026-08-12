import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SkillsModule } from '../skills/skills.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

@Module({
  // AuthModule is @Global() and exports jwtModule (so JwtService
  // resolves anywhere) plus the guard classes themselves — but
  // @UseGuards(JwtAuthGuard) on the controller below still needs
  // JwtAuthGuard declared as a provider in *this* module's own graph,
  // confirmed by testing (a version without this line threw
  // UnknownDependenciesException at boot). Re-declaring it just
  // instantiates a second, harmless instance of the same stateless
  // guard.
  imports: [DbModule, SkillsModule, AuthModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, JwtAuthGuard, RolesGuard],
})
export class CandidatesModule {}
