import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { NotesService } from './notes.service';
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
}
