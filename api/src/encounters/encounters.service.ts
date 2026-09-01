import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { SpeakerLabelDto } from './dto/update-speaker-labels.dto';

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

  // Never inferred automatically (see the schema comment on
  // Transcript.speakerLabels) — the reviewing clinician assigns these after
  // the fact, having actually been in the room, which is the only way to
  // label a speaker as "Clinician"/a patient's name without risking a wrong
  // guess baked into the record as if it were fact.
  async updateSpeakerLabels(cognitoSub: string, encounterId: string, labels: SpeakerLabelDto[]) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    await this.assertClinicOwnsEncounter(encounterId, actor.clinicId);

    const transcript = await this.prisma.transcript.findUnique({ where: { encounterId } });
    if (!transcript) throw new NotFoundException('Transcript not found for this encounter');

    // Reject labels for a speaker key that was never actually diarized —
    // catches a stale client sending an assignment against an outdated
    // transcript view, rather than silently storing a label that can never
    // match anything.
    const knownSpeakers = new Set(
      Array.isArray(transcript.diarizedSegments)
        ? (transcript.diarizedSegments as Array<{ speaker?: string }>).map((s) => s.speaker)
        : [],
    );
    const unknown = labels.find((l) => !knownSpeakers.has(l.speaker));
    if (unknown) {
      throw new NotFoundException(`Speaker "${unknown.speaker}" was not found in this transcript`);
    }

    // Merge, not replace — assigning one speaker's label shouldn't clear a
    // label already set for the other speaker in an earlier request.
    const existing =
      transcript.speakerLabels && typeof transcript.speakerLabels === 'object'
        ? (transcript.speakerLabels as Record<string, string>)
        : {};
    const merged: Record<string, string> = { ...existing };
    for (const l of labels) merged[l.speaker] = l.label;

    return this.prisma.transcript.update({
      where: { encounterId },
      data: { speakerLabels: merged as Prisma.InputJsonValue },
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
