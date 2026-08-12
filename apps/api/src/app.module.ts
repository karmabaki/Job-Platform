import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SkillsModule } from './skills/skills.module';
import { CandidatesModule } from './candidates/candidates.module';
import { EmployersModule } from './employers/employers.module';

@Module({
  imports: [AuthModule, SkillsModule, CandidatesModule, EmployersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
