import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveDataRequestDto {
  @IsIn(['approved', 'denied'])
  status: string;

  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
