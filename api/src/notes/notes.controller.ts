import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { buildNotePdf } from './note-pdf';
import { NotesService } from './notes.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { UpdateClinicalNoteDto } from './dto/update-clinical-note.dto';

@UseGuards(CognitoAuthGuard)
@Controller('encounters/:encounterId/note')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findLatest(@Param('encounterId') encounterId: string) {
    return this.notesService.findLatest(encounterId);
  }

  @Patch()
  update(@Param('encounterId') encounterId: string, @Body() dto: UpdateClinicalNoteDto, @Req() req: any) {
    return this.notesService.update(encounterId, req.user.sub, dto);
  }

  @Post('sign')
  sign(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.notesService.sign(encounterId, req.user.sub);
  }

  @Post('feedback')
  submitFeedback(
    @Param('encounterId') encounterId: string,
    @Body() dto: SubmitFeedbackDto,
    @Req() req: any,
  ) {
    return this.notesService.submitFeedback(encounterId, req.user.sub, dto);
  }

  @Get('pdf')
  async downloadPdf(@Param('encounterId') encounterId: string, @Res() res: Response) {
    const { note, encounter } = await this.notesService.getForExport(encounterId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="visit-note-${encounterId}.pdf"`);
    const doc = buildNotePdf(note, encounter);
    doc.pipe(res);
    doc.end();
  }
}
