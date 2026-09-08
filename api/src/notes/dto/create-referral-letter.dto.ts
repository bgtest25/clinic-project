import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReferralLetterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialty: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
