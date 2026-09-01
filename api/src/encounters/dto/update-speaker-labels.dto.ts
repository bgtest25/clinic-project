import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';

export class SpeakerLabelDto {
  @IsString()
  @IsNotEmpty()
  speaker: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;
}

export class UpdateSpeakerLabelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SpeakerLabelDto)
  labels: SpeakerLabelDto[];
}
