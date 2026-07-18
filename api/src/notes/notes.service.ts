import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { EncountersService } from '../encounters/encounters.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { UpdateClinicalNoteDto } from './dto/update-clinical-note.dto';

const NOTE_FIELDS = ['subjective', 'objective', 'assessment', 'plan', 'suggestedCodes'] as const;

function toAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// Prisma's generated input types reject a plain `null` for a nullable Json
// field — it needs the Prisma.JsonNull sentinel instead.
function toJsonInput(value: Prisma.JsonValue | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : value;
}

@Injectable()
export class NotesService {
  private readonly s3 = new S3Client({});

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly encountersService: EncountersService,
  ) {}

  // Every public entry point funnels through here first — verifies the
  // caller's clinic actually owns this encounter before anything else runs.
  async findLatest(encounterId: string, cognitoSub: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    await this.encountersService.assertClinicOwnsEncounter(encounterId, actor.clinicId);

    const note = await this.prisma.clinicalNote.findFirst({
      where: { encounterId },
      orderBy: { version: 'desc' },
    });
    if (!note) throw new NotFoundException('No clinical note for this encounter yet');
    return note;
  }

  async update(encounterId: string, cognitoSub: string, dto: UpdateClinicalNoteDto) {
    const latest = await this.findLatest(encounterId, cognitoSub);
    const actor = await this.usersService.findByCognitoSub(cognitoSub);

    const changedFields = NOTE_FIELDS.filter(
      (field) => dto[field] !== undefined && dto[field] !== (latest as Record<string, unknown>)[field],
    );

    // A signed note is locked — an edit after sign-off creates a new versioned
    // amendment instead of mutating history, per the audit/compliance requirement.
    const note =
      latest.status === 'SIGNED'
        ? await this.prisma.clinicalNote.create({
            data: {
              encounterId,
              version: latest.version + 1,
              status: 'AMENDED',
              subjective: dto.subjective ?? latest.subjective,
              objective: dto.objective ?? latest.objective,
              assessment: dto.assessment ?? latest.assessment,
              plan: dto.plan ?? latest.plan,
              suggestedCodes: toJsonInput(dto.suggestedCodes ?? latest.suggestedCodes),
            },
          })
        : await this.prisma.clinicalNote.update({
            where: { id: latest.id },
            data: Object.fromEntries(changedFields.map((field) => [field, dto[field]])),
          });

    if (changedFields.length) {
      await this.prisma.auditLog.createMany({
        data: changedFields.map((field) => ({
          encounterId,
          actorId: actor.id,
          action: latest.status === 'SIGNED' ? 'note.amend' : 'note.edit',
          fieldChanged: field,
          oldValue: toAuditValue((latest as Record<string, unknown>)[field]),
          newValue: toAuditValue(dto[field]),
        })),
      });
    }

    return note;
  }

  async getForExport(encounterId: string, cognitoSub: string) {
    const note = await this.findLatest(encounterId, cognitoSub);
    const encounter = await this.prisma.encounter.findUniqueOrThrow({
      where: { id: encounterId },
      include: { patient: true, clinician: true },
    });
    return { note, encounter };
  }

  async sign(encounterId: string, cognitoSub: string) {
    const latest = await this.findLatest(encounterId, cognitoSub);
    if (latest.status === 'SIGNED') {
      throw new ForbiddenException('This note is already signed — edit it to create a new amendment first');
    }
    const actor = await this.usersService.findByCognitoSub(cognitoSub);

    const [note] = await this.prisma.$transaction([
      this.prisma.clinicalNote.update({
        where: { id: latest.id },
        data: { status: 'SIGNED', signedById: actor.id, signedAt: new Date() },
      }),
      this.prisma.encounter.update({ where: { id: encounterId }, data: { status: 'SIGNED' } }),
      this.prisma.auditLog.create({
        data: { encounterId, actorId: actor.id, action: 'note.sign' },
      }),
    ]);

    // Retention: raw audio is no longer needed once the note built from it is
    // signed — the transcript and note are the record of the visit going
    // forward. Best-effort and never blocks signing: the bucket's lifecycle
    // rule is the backstop if this doesn't run (e.g. S3 hiccup).
    await this.purgeRawAudio(encounterId, actor.id).catch(() => {});

    return note;
  }

  async submitFeedback(encounterId: string, cognitoSub: string, dto: SubmitFeedbackDto) {
    const latest = await this.findLatest(encounterId, cognitoSub);
    if (latest.status !== 'SIGNED') {
      throw new ForbiddenException('Feedback can only be submitted for a signed note');
    }
    const actor = await this.usersService.findByCognitoSub(cognitoSub);

    const [note] = await this.prisma.$transaction([
      this.prisma.clinicalNote.update({
        where: { id: latest.id },
        data: { satisfactionRating: dto.rating, feedbackComment: dto.comment ?? null },
      }),
      this.prisma.auditLog.create({
        data: {
          encounterId,
          actorId: actor.id,
          action: 'note.feedback',
          newValue: String(dto.rating),
        },
      }),
    ]);

    return note;
  }

  // actorId here is the signing clinician — the purge is a direct, synchronous
  // consequence of their sign action, not an independent background job.
  private async purgeRawAudio(encounterId: string, actorId: string) {
    const recording = await this.prisma.audioRecording.findUnique({ where: { encounterId } });
    if (!recording || recording.deletedAt) return;

    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET_NAME, Key: recording.s3Key }),
      );
      await this.prisma.$transaction([
        this.prisma.audioRecording.update({ where: { encounterId }, data: { deletedAt: new Date() } }),
        this.prisma.auditLog.create({
          data: { encounterId, actorId, action: 'audio.purged', newValue: recording.s3Key },
        }),
      ]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await this.prisma.auditLog.create({
        data: { encounterId, actorId, action: 'audio.purge_failed', newValue: reason.slice(0, 2000) },
      });
      throw err;
    }
  }
}
