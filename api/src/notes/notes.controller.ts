import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { buildNotePdf } from './note-pdf';
import { NotesService } from './notes.service';
import { CreatePriorAuthDto } from './dto/create-prior-auth.dto';
import { CreateReferralLetterDto } from './dto/create-referral-letter.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { UpdateClinicalNoteDto } from './dto/update-clinical-note.dto';

@UseGuards(CognitoAuthGuard)
@Controller('encounters/:encounterId/note')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findLatest(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.notesService.findLatest(encounterId, req.user.sub);
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
  async downloadPdf(@Param('encounterId') encounterId: string, @Res() res: Response, @Req() req: any) {
    const { note, encounter } = await this.notesService.getForExport(encounterId, req.user.sub);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="visit-note-${encounterId}.pdf"`);
    const doc = buildNotePdf(note, encounter);
    doc.pipe(res);
    doc.end();
  }

  @Post('avs')
  generateAfterVisitSummary(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.notesService.generateAfterVisitSummary(encounterId, req.user.sub);
  }

  @Get('avs')
  getAfterVisitSummary(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.notesService.getAfterVisitSummary(encounterId, req.user.sub);
  }

  @Post('referrals')
  generateReferralLetter(
    @Param('encounterId') encounterId: string,
    @Body() dto: CreateReferralLetterDto,
    @Req() req: any,
  ) {
    return this.notesService.generateReferralLetter(encounterId, req.user.sub, dto);
  }

  @Get('referrals')
  getReferralLetters(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.notesService.getReferralLetters(encounterId, req.user.sub);
  }

  @Post('prior-auths')
  generatePriorAuth(
    @Param('encounterId') encounterId: string,
    @Body() dto: CreatePriorAuthDto,
    @Req() req: any,
  ) {
    return this.notesService.generatePriorAuth(encounterId, req.user.sub, dto);
  }

  @Get('prior-auths')
  getPriorAuths(@Param('encounterId') encounterId: string, @Req() req: any) {
    return this.notesService.getPriorAuths(encounterId, req.user.sub);
  }
}
