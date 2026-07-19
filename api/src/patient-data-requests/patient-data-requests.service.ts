import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { CreateDataRequestDto } from './dto/create-data-request.dto';
import { ResolveDataRequestDto } from './dto/resolve-data-request.dto';

@Injectable()
export class PatientDataRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly patientsService: PatientsService,
  ) {}

  async create(cognitoSub: string, patientId: string, dto: CreateDataRequestDto) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    await this.patientsService.assertClinicOwnsPatient(patientId, actor.clinicId);

    const [request] = await this.prisma.$transaction([
      this.prisma.patientDataRequest.create({
        data: {
          patientId,
          requestType: dto.requestType,
          reason: dto.reason ?? null,
          loggedById: actor.id,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          patientId,
          actorId: actor.id,
          action: 'patient.data_request_logged',
          newValue: dto.requestType,
        },
      }),
    ]);
    return request;
  }

  async findAll(cognitoSub: string, patientId: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    await this.patientsService.assertClinicOwnsPatient(patientId, actor.clinicId);

    return this.prisma.patientDataRequest.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(
    cognitoSub: string,
    patientId: string,
    requestId: string,
    dto: ResolveDataRequestDto,
  ) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    await this.patientsService.assertClinicOwnsPatient(patientId, actor.clinicId);

    const existing = await this.prisma.patientDataRequest.findFirst({
      where: { id: requestId, patientId },
    });
    if (!existing) throw new NotFoundException('Data request not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.patientDataRequest.update({
        where: { id: requestId },
        data: {
          status: dto.status,
          resolutionNote: dto.resolutionNote ?? null,
          resolvedAt: new Date(),
          resolvedById: actor.id,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          patientId,
          actorId: actor.id,
          action: 'patient.data_request_resolved',
          fieldChanged: 'status',
          oldValue: existing.status,
          newValue: dto.status,
        },
      }),
    ]);
    return updated;
  }
}
