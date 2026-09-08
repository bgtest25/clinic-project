import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MD', 'DO', 'NP', 'PA', 'APRN', 'RN', 'LPN', 'LCSW', 'LMFT', 'PhD', 'PsyD', 'DPT', 'OD', 'DPM', 'DC', 'DMD', 'DDS', 'PharmD'])
  credentials?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'NPI must be exactly 10 digits' })
  individualNpi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  licenseState?: string;
}

export class UploadSignatureDto {
  @IsString()
  signatureUrl: string;

  @IsString()
  @IsIn(['typed', 'drawn', 'uploaded'])
  signatureType: 'typed' | 'drawn' | 'uploaded';
}

export class CompleteHipaaTrainingDto {
  @IsOptional()
  @IsString()
  attestationText?: string;
}
