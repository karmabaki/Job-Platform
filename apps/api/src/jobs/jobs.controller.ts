import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, SessionPayload } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { ReplaceJobSkillsDto } from './dto/replace-job-skills.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(@Query() query: ListJobsQueryDto) {
    return this.jobsService.list(query);
  }

  // Public, but OptionalJwtAuthGuard attaches request.user when a
  // valid session is present, so the service can show a draft/closed
  // job to its owning employer while 404-ing everyone else.
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = (req as Request & { user?: SessionPayload }).user;
    return this.jobsService.getById(
      id,
      user && { userId: user.sub, role: user.role },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Post()
  create(@Req() req: Request, @Body() dto: CreateJobDto) {
    return this.jobsService.create(userId(req), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.update(userId(req), id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.jobsService.publish(userId(req), id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Post(':id/close')
  close(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.jobsService.close(userId(req), id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('employer')
  @Put(':id/skills')
  replaceSkills(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Body() dto: ReplaceJobSkillsDto,
  ) {
    return this.jobsService.replaceSkills(userId(req), id, dto.skillIds);
  }
}

function userId(req: Request): string {
  return (req as Request & { user: SessionPayload }).user.sub;
}
