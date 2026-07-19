import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateDataRequestDto {
  @IsIn(['deletion', 'amendment'])
  requestType: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
