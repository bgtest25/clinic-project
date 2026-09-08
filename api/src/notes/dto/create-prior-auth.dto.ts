import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePriorAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  procedureOrMed: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  diagnosisCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  insurerName?: string;
}
