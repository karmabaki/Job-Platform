import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, exists, ilike, inArray, or } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DB } from '../db/db.module';
import { skills, skillAliases } from '../db/skills';

export interface PublicSkill {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  isActive: boolean;
}

const SKILL_COLUMNS = {
  id: skills.id,
  slug: skills.slug,
  name: skills.name,
  category: skills.category,
  isActive: skills.isActive,
};

@Injectable()
export class SkillsService {
  constructor(@Inject(DB) private readonly db: NeonHttpDatabase) {}

  // Matches on name, slug, or a known alias (e.g. "js" finds
  // JavaScript) — aliases exist specifically to make search/autocomplete
  // work with free-text variants, per docs/database-design.md Key
  // decision #1.
  async list(search?: string): Promise<PublicSkill[]> {
    const pattern = search ? `%${search}%` : undefined;

    const matchesSearch = pattern
      ? and(
          eq(skills.isActive, true),
          or(
            ilike(skills.name, pattern),
            ilike(skills.slug, pattern),
            exists(
              this.db
                .select({ id: skillAliases.id })
                .from(skillAliases)
                .where(
                  and(
                    eq(skillAliases.skillId, skills.id),
                    ilike(skillAliases.alias, pattern),
                  ),
                ),
            ),
          ),
        )
      : eq(skills.isActive, true);

    return this.db
      .select(SKILL_COLUMNS)
      .from(skills)
      .where(matchesSearch)
      .orderBy(skills.name);
  }

  async getById(id: string): Promise<PublicSkill> {
    const [skill] = await this.db
      .select(SKILL_COLUMNS)
      .from(skills)
      .where(eq(skills.id, id));
    if (!skill) {
      throw new NotFoundException('Skill not found.');
    }
    return skill;
  }

  // Used by other modules (e.g. candidates, when replacing a skill
  // list) to validate a batch of ids without reaching into the
  // `skills` table directly — keeps the module boundary from
  // docs/database-design.md's "no accessing another module's internal
  // implementation" rule.
  async getManyByIds(
    ids: string[],
  ): Promise<{ id: string; isActive: boolean }[]> {
    if (ids.length === 0) return [];
    return this.db
      .select({ id: skills.id, isActive: skills.isActive })
      .from(skills)
      .where(inArray(skills.id, ids));
  }
}
