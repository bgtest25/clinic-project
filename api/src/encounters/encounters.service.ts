import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async create(cognitoSub: string, dto: CreateEncounterDto) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, clinicId: actor.clinicId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const clinician = await this.prisma.user.findFirst({
      where: { id: dto.clinicianId, clinicId: actor.clinicId },
    });
    if (!clinician) throw new NotFoundException('Clinician not found');

    return this.prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        clinicianId: dto.clinicianId,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
      },
    });
  }

  async findAll(cognitoSub: string, clinicianId?: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    return this.prisma.encounter.findMany({
      where: {
        clinician: { clinicId: actor.clinicId },
        ...(clinicianId ? { clinicianId } : {}),
      },
      include: { patient: true },
      orderBy: { visitDate: 'desc' },
    });
  }

  async findOne(cognitoSub: string, id: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    const encounter = await this.prisma.encounter.findFirst({
      where: { id, clinician: { clinicId: actor.clinicId } },
      include: { patient: true, clinicalNotes: true, transcript: true, audioRecording: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    return encounter;
  }

  async captureConsent(cognitoSub: string, id: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    await this.assertClinicOwnsEncounter(id, actor.clinicId);

    return this.prisma.encounter.update({
      where: { id },
      data: { consentCapturedAt: new Date(), consentCapturedBy: actor.id },
    });
  }

  // Shared by NotesService/RecordingsService — both operate purely on an
  // encounterId, so this is the one place that knows how to check "does this
  // encounter actually belong to this clinic" rather than duplicating the
  // same join in three services. 404s (not 403) on a mismatch — don't confirm
  // to a caller from another clinic that the ID even exists.
  async assertClinicOwnsEncounter(encounterId: string, clinicId: string) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, clinician: { clinicId } },
      select: { id: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
  }
}
