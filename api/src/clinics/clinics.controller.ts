import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { ClinicsService } from './clinics.service';

// No POST /clinics here — deliberately removed 2026-08-31. There is no
// platform-superadmin concept in this system (every user belongs to
// exactly one clinic), so a regular clinic admin creating brand-new
// tenant clinics was never an intended capability; it was only ever
// gated by @Roles('admin'), meaning any admin of any clinic could call
// it. Found during the authorization audit prompted by the 2026-08-31
// invite() vulnerability — same class of over-broad admin capability,
// though this one never exposed another clinic's existing data (a new
// clinic starts empty with no members, per ClinicsService.create's old
// behavior). The frontend never called it (only GET /clinics) and
// PILOT-ONBOARDING-RUNBOOK.md already documents clinic creation as a
// manual, direct-DB/Cognito process — this endpoint had no legitimate
// caller.
@UseGuards(CognitoAuthGuard)
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.clinicsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.clinicsService.findOne(req.user.sub, id);
  }
}
