import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateDataRequestDto } from './dto/create-data-request.dto';
import { ResolveDataRequestDto } from './dto/resolve-data-request.dto';
import { PatientDataRequestsService } from './patient-data-requests.service';

@UseGuards(CognitoAuthGuard, RolesGuard)
@Controller('patients/:patientId/data-requests')
export class PatientDataRequestsController {
  constructor(private readonly service: PatientDataRequestsService) {}

  @Post()
  create(@Param('patientId') patientId: string, @Body() dto: CreateDataRequestDto, @Req() req: any) {
    return this.service.create(req.user.sub, patientId, dto);
  }

  @Get()
  findAll(@Param('patientId') patientId: string, @Req() req: any) {
    return this.service.findAll(req.user.sub, patientId);
  }

  @Patch(':requestId')
  @Roles('admin')
  resolve(
    @Param('patientId') patientId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ResolveDataRequestDto,
    @Req() req: any,
  ) {
    return this.service.resolve(req.user.sub, patientId, requestId, dto);
  }
}
