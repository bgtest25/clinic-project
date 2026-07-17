import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateEncounterDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  clinicianId: string;

  @IsOptional()
  @IsDateString()
  visitDate?: string;
}
