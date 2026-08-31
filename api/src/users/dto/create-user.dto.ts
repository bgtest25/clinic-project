import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';

// clinicId is deliberately not a field here — it must always be the calling
// admin's own clinic, never client-supplied (see UsersService.invite). Same
// pattern as CreatePatientDto.
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;
}
