import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignBaaDto {
  @IsString()
  @IsNotEmpty()
  signatoryName: string;

  @IsString()
  @IsNotEmpty()
  signatoryTitle: string;

  @IsEmail()
  signatoryEmail: string;
}
