import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { OnboardingService } from './onboarding.service';
import { SignBaaDto } from './dto/sign-baa.dto';
import { UpdateClinicProfileDto } from './dto/update-clinic-profile.dto';
import { UpdateUserProfileDto, UploadSignatureDto, CompleteHipaaTrainingDto } from './dto/update-user-profile.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('npi/verify')
  async verifyNpi(@Query('npi') npi: string) {
    return this.onboardingService.verifyNpi(npi);
  }

  @UseGuards(CognitoAuthGuard)
  @Get('status')
  async getOnboardingStatus(@Req() req: any) {
    return this.onboardingService.getOnboardingStatus(req.user.sub);
  }

  @UseGuards(CognitoAuthGuard)
  @Post('clinic/:clinicId/baa')
  async signBaa(@Param('clinicId') clinicId: string, @Body() dto: SignBaaDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    return this.onboardingService.signBaa(req.user.sub, {
      clinicId,
      signatoryName: dto.signatoryName,
      signatoryTitle: dto.signatoryTitle,
      signatoryEmail: dto.signatoryEmail,
      ipAddress,
    });
  }

  @UseGuards(CognitoAuthGuard)
  @Patch('clinic/:clinicId/profile')
  async updateClinicProfile(
    @Param('clinicId') clinicId: string,
    @Body() dto: UpdateClinicProfileDto,
    @Req() req: any,
  ) {
    return this.onboardingService.updateClinicProfile(clinicId, req.user.sub, dto);
  }

  @UseGuards(CognitoAuthGuard)
  @Post('clinic/:clinicId/logo')
  async uploadClinicLogo(
    @Param('clinicId') clinicId: string,
    @Body('logoUrl') logoUrl: string,
    @Req() req: any,
  ) {
    return this.onboardingService.uploadClinicLogo(clinicId, req.user.sub, logoUrl);
  }

  @UseGuards(CognitoAuthGuard)
  @Post('clinic/:clinicId/activate')
  async activateClinic(@Param('clinicId') clinicId: string, @Req() req: any) {
    return this.onboardingService.activateClinic(clinicId, req.user.sub);
  }

  @UseGuards(CognitoAuthGuard)
  @Patch('profile')
  async updateUserProfile(@Body() dto: UpdateUserProfileDto, @Req() req: any) {
    return this.onboardingService.updateUserProfile(req.user.sub, dto);
  }

  @UseGuards(CognitoAuthGuard)
  @Post('profile/signature')
  async uploadSignature(@Body() dto: UploadSignatureDto, @Req() req: any) {
    return this.onboardingService.uploadSignature(req.user.sub, dto.signatureUrl, dto.signatureType);
  }

  @UseGuards(CognitoAuthGuard)
  @Post('training/hipaa')
  async completeHipaaTraining(@Body() dto: CompleteHipaaTrainingDto, @Req() req: any) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    return this.onboardingService.completeHipaaTraining(req.user.sub, {
      attestationText: dto.attestationText ?? undefined,
      ipAddress,
    });
  }

  @UseGuards(CognitoAuthGuard)
  @Post('complete')
  async completeOnboarding(@Req() req: any) {
    return this.onboardingService.completeOnboarding(req.user.sub);
  }
}
