import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, SessionPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

// No base path — routes span /jobs/..., /candidates/..., and
// /applications/... prefixes that belong conceptually to other
// modules. Deliberately not added as extra routes on
// JobsController/CandidatesController, per "IN SCOPE: ... applications
// module" — everything application-related lives here instead.
@Controller()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidate')
  @Post('jobs/:id/applications')
  apply(
    @Param('id', ParseUUIDPipe) jobId: string,
    @Req() req: Request,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.apply(userId(req), jobId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidate')
  @Get('candidates/me/applications')
  getOwnApplications(@Req() req: Request) {
    return this.applicationsService.getOwnApplications(userId(req));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Get('jobs/:id/applications')
  getJobApplications(
    @Param('id', ParseUUIDPipe) jobId: string,
    @Req() req: Request,
  ) {
    return this.applicationsService.getJobApplications(userId(req), jobId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Patch('applications/:id')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(userId(req), id, dto);
  }
}

function userId(req: Request): string {
  return (req as Request & { user: SessionPayload }).user.sub;
}
