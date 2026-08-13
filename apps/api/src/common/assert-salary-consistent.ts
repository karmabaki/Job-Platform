import { BadRequestException } from '@nestjs/common';

// Shared by candidates (salaryExpectationMin/Max) and jobs
// (salaryMin/Max) — same three rules as the DB CHECK constraints in
// docs/database-design.md Key decision #2, enforced here too so
// violations get a clear message instead of a raw constraint error.
export function assertSalaryConsistent(salary: {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  period?: string | null;
}): void {
  const min = salary.min ?? undefined;
  const max = salary.max ?? undefined;
  const currency = salary.currency ?? undefined;
  const period = salary.period ?? undefined;

  if (min !== undefined && min < 0) {
    throw new BadRequestException('Minimum salary cannot be negative.');
  }
  if (max !== undefined && max < 0) {
    throw new BadRequestException('Maximum salary cannot be negative.');
  }
  if (min !== undefined && max !== undefined && max < min) {
    throw new BadRequestException(
      'Maximum salary cannot be less than minimum salary.',
    );
  }
  const hasAmount = min !== undefined || max !== undefined;
  if (hasAmount && (!currency || !period)) {
    throw new BadRequestException(
      'Currency and period are both required when a salary amount is set.',
    );
  }
}
