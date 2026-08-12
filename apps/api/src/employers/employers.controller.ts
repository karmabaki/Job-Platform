import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, SessionPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { EmployersService } from './employers.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employer')
@Controller('employers/me/company')
export class EmployersController {
  constructor(private readonly employersService: EmployersService) {}

  @Get()
  getOwnCompany(@Req() req: Request) {
    return this.employersService.getOwnCompany(userId(req));
  }

  @Post()
  createCompany(@Req() req: Request, @Body() dto: CreateCompanyDto) {
    return this.employersService.createCompany(userId(req), dto);
  }

  @Patch()
  updateCompany(@Req() req: Request, @Body() dto: UpdateCompanyDto) {
    return this.employersService.updateCompany(userId(req), dto);
  }
}

function userId(req: Request): string {
  return (req as Request & { user: SessionPayload }).user.sub;
}
