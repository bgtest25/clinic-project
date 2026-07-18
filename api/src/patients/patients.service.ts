import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(cognitoSub: string, dto: CreatePatientDto) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    // clinicId is never client-supplied — always the caller's own clinic,
    // so a request can't create a patient under someone else's clinic.
    return this.prisma.patient.create({
      data: { name: dto.name, dateOfBirth: new Date(dto.dateOfBirth), clinicId: actor.clinicId },
    });
  }

  async findAll(cognitoSub: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    return this.prisma.patient.findMany({ where: { clinicId: actor.clinicId } });
  }

  async findOne(cognitoSub: string, id: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    const patient = await this.prisma.patient.findFirst({ where: { id, clinicId: actor.clinicId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(cognitoSub: string, id: string, dto: UpdatePatientDto) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    const patient = await this.prisma.patient.findFirst({ where: { id, clinicId: actor.clinicId } });
    if (!patient) throw new NotFoundException('Patient not found');

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }
}
