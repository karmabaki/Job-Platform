import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { DB, DB_TX } from '../db/db.module';
import { companies } from '../db/companies';
import { users } from '../db/users';
import { assertCountryAllowed } from '../db/countries.helpers';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

export type Company = typeof companies.$inferSelect;

@Injectable()
export class EmployersService {
  constructor(
    @Inject(DB) private readonly db: NeonHttpDatabase,
    @Inject(DB_TX) private readonly dbTx: NeonDatabase,
  ) {}

  async getOwnCompany(userId: string): Promise<Company> {
    const companyId = await this.getOwnCompanyId(userId);
    if (!companyId) {
      throw new NotFoundException('No company found for this account.');
    }
    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));
    if (!company) {
      throw new NotFoundException('No company found for this account.');
    }
    return company;
  }

  async createCompany(userId: string, dto: CreateCompanyDto): Promise<Company> {
    const countryCode = await assertCountryAllowed(
      this.db,
      dto.countryCode,
      'employerAllowed',
      'employers',
    );

    // Real transaction (see db/db.module.ts DB_TX): "create a company"
    // and "link the current user to it" must succeed or fail together.
    // The company_id re-check happens inside the transaction to narrow
    // (not fully close — see report) the race where the same user
    // fires two POSTs concurrently.
    return this.dbTx.transaction(async (tx) => {
      const [user] = await tx
        .select({ companyId: users.companyId })
        .from(users)
        .where(eq(users.id, userId));
      if (user?.companyId) {
        throw new ConflictException(
          'This account is already linked to a company.',
        );
      }

      const [company] = await tx
        .insert(companies)
        .values({
          name: dto.name,
          website: dto.website,
          countryCode,
          description: dto.description,
        })
        .returning();

      await tx
        .update(users)
        .set({ companyId: company.id })
        .where(eq(users.id, userId));

      return company;
    });
  }

  async updateCompany(userId: string, dto: UpdateCompanyDto): Promise<Company> {
    const companyId = await this.getOwnCompanyId(userId);
    if (!companyId) {
      throw new NotFoundException('No company found for this account.');
    }

    const updateValues: Partial<typeof companies.$inferInsert> = {};
    if (dto.name !== undefined) updateValues.name = dto.name;
    if (dto.website !== undefined) updateValues.website = dto.website;
    if (dto.description !== undefined)
      updateValues.description = dto.description;
    if (dto.countryCode !== undefined) {
      updateValues.countryCode = await assertCountryAllowed(
        this.db,
        dto.countryCode,
        'employerAllowed',
        'employers',
      );
    }

    if (Object.keys(updateValues).length === 0) {
      const [company] = await this.db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId));
      return company;
    }

    const [updated] = await this.db
      .update(companies)
      .set(updateValues)
      .where(eq(companies.id, companyId))
      .returning();
    return updated;
  }

  private async getOwnCompanyId(userId: string): Promise<string | null> {
    const [user] = await this.db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, userId));
    return user?.companyId ?? null;
  }
}
