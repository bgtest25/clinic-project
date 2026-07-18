import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MetricsService } from './metrics.service';

@UseGuards(CognitoAuthGuard, RolesGuard)
@Controller('clinics/:clinicId/metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Roles('admin')
  summary(@Param('clinicId') clinicId: string) {
    return this.metricsService.summary(clinicId);
  }
}
