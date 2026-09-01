import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { UpdateSpeakerLabelsDto } from './dto/update-speaker-labels.dto';
import { EncountersService } from './encounters.service';

@UseGuards(CognitoAuthGuard)
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  create(@Body() dto: CreateEncounterDto, @Req() req: any) {
    return this.encountersService.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Query('clinicianId') clinicianId: string | undefined, @Req() req: any) {
    return this.encountersService.findAll(req.user.sub, clinicianId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.encountersService.findOne(req.user.sub, id);
  }

  @Patch(':id/consent')
  captureConsent(@Param('id') id: string, @Req() req: any) {
    return this.encountersService.captureConsent(req.user.sub, id);
  }

  @Patch(':id/transcript/speaker-labels')
  updateSpeakerLabels(@Param('id') id: string, @Body() dto: UpdateSpeakerLabelsDto, @Req() req: any) {
    return this.encountersService.updateSpeakerLabels(req.user.sub, id, dto.labels);
  }
}
