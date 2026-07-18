import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async findLatest(encounterId: string) {
    const note = await this.prisma.clinicalNote.findFirst({
      where: { encounterId },
      orderBy: { version: 'desc' },
    });
    if (!note) throw new NotFoundException('No clinical note for this encounter yet');
    return note;
  }

  async update(encounterId: string, cognitoSub: string, dto: UpdateClinicalNoteDto) {
    const latest = await this.findLatest(encounterId);
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

  async sign(encounterId: string, cognitoSub: string) {
    const latest = await this.findLatest(encounterId);
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

    return note;
  }
}
