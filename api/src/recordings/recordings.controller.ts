import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { RecordingsService } from './recordings.service';

@UseGuards(CognitoAuthGuard)
@Controller('encounters/:encounterId/recording')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  @Post('start-upload')
  startUpload(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.recordingsService.createUploadUrl(encounterId, req.user.sub);
  }

  @Post('complete')
  complete(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.recordingsService.completeUpload(encounterId, req.user.sub);
  }
}
