import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { ListSkillsQueryDto } from './dto/list-skills-query.dto';

// Public — no auth guard. Anyone (including unauthenticated visitors
// browsing before registering) can see the admin-curated skill list.
@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  list(@Query() query: ListSkillsQueryDto) {
    return this.skillsService.list(query.search);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.skillsService.getById(id);
  }
}
