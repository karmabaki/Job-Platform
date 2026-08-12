import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, SessionPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CandidatesService } from './candidates.service';
import { CreateCandidateProfileDto } from './dto/create-candidate-profile.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';
import { ReplaceCandidateSkillsDto } from './dto/replace-candidate-skills.dto';

// Guard order matters: JwtAuthGuard must run first to populate
// request.user before RolesGuard reads it. Applied at the controller
// level (broader than the spec's literal "before creating a profile")
// as defense-in-depth — there's no legitimate reason for a
// non-candidate to hit any /candidates/me route.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('candidate')
@Controller('candidates/me')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  getOwnProfile(@Req() req: Request) {
    return this.candidatesService.getOwnProfile(userId(req));
  }

  @Post()
  createProfile(@Req() req: Request, @Body() dto: CreateCandidateProfileDto) {
    return this.candidatesService.createProfile(userId(req), dto);
  }

  @Patch()
  updateProfile(@Req() req: Request, @Body() dto: UpdateCandidateProfileDto) {
    return this.candidatesService.updateProfile(userId(req), dto);
  }

  @Put('skills')
  replaceSkills(@Req() req: Request, @Body() dto: ReplaceCandidateSkillsDto) {
    return this.candidatesService.replaceSkills(userId(req), dto.skillIds);
  }
}

function userId(req: Request): string {
  return (req as Request & { user: SessionPayload }).user.sub;
}
