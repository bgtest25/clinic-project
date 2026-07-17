import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { EncountersService } from './encounters.service';

@UseGuards(CognitoAuthGuard)
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  create(@Body() dto: CreateEncounterDto) {
    return this.encountersService.create(dto);
  }

  @Get()
  findAll(@Query('clinicianId') clinicianId?: string) {
    return this.encountersService.findAll(clinicianId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.encountersService.findOne(id);
  }

  @Patch(':id/consent')
  captureConsent(@Param('id') id: string, @Req() req: any) {
    return this.encountersService.captureConsent(id, req.user?.username ?? req.user?.sub);
  }
}
