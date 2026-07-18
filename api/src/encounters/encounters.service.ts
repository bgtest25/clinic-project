import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';

@Injectable()
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEncounterDto) {
    return this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        clinicianId: dto.clinicianId,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
      },
    });
  }

  findAll(clinicianId?: string) {
    return this.prisma.encounter.findMany({
      where: clinicianId ? { clinicianId } : undefined,
      include: { patient: true },
      orderBy: { visitDate: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.encounter.findUniqueOrThrow({
      where: { id },
      include: { patient: true, clinicalNotes: true, transcript: true, audioRecording: true },
    });
  }

  captureConsent(id: string, capturedBy: string) {
    return this.prisma.encounter.update({
      where: { id },
      data: { consentCapturedAt: new Date(), consentCapturedBy: capturedBy },
    });
  }
}
