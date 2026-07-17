import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { RecordingsService } from './recordings.service';

@UseGuards(CognitoAuthGuard)
@Controller('encounters/:encounterId/recording')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('start-upload')
  startUpload(@Param('encounterId') encounterId: string) {
    return this.recordingsService.createUploadUrl(encounterId);
  }

  @Post('complete')
  complete(@Param('encounterId') encounterId: string) {
    return this.recordingsService.completeUpload(encounterId);
  }
}
