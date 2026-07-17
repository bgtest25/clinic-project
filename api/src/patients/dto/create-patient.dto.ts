import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePatientDto {
  @IsUUID()
  clinicId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  dateOfBirth: string;
}
