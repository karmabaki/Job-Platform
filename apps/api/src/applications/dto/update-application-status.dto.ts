import { IsIn } from 'class-validator';

const APPLICATION_STATUS_VALUES = [
  'applied',
  'shortlisted',
  'rejected',
  'hired',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS_VALUES)[number];

export class UpdateApplicationStatusDto {
  @IsIn(APPLICATION_STATUS_VALUES)
  status: ApplicationStatus;
}
