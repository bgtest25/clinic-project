import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

interface ReviewTimeRow {
  avgSeconds: number | null;
  total: bigint;
}

interface EditCountRow {
  avgEdits: number | null;
}

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async summary(clinicId: string, cognitoSub: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    if (actor.clinicId !== clinicId) {
      throw new ForbiddenException("Cannot view another clinic's metrics");
    }

    // Review time: how long a note sat in front of a clinician before they
    // signed it — the measurable proxy for documentation time, since the
    // system has no way to know how long an unassisted note would have taken.
    const [reviewTime] = await this.prisma.$queryRaw<ReviewTimeRow[]>`
      SELECT
        AVG(EXTRACT(EPOCH FROM (cn."signedAt" - cn."createdAt"))) AS "avgSeconds",
        COUNT(*) AS total
      FROM "clinical_notes" cn
      JOIN "encounters" e ON e.id = cn."encounterId"
      JOIN "users" u ON u.id = e."clinicianId"
      WHERE cn.status = 'SIGNED' AND u."clinicId" = ${clinicId}
    `;

    const satisfaction = await this.prisma.clinicalNote.aggregate({
      where: {
        satisfactionRating: { not: null },
        encounter: { clinician: { clinicId } },
      },
      _avg: { satisfactionRating: true },
      _count: { satisfactionRating: true },
    });

    // Fewer edits before signing suggests the draft needed less rework —
    // a proxy for draft quality, distinct from review time (a clinician
    // could sit on a good draft a while just reading it closely).
    const [editCount] = await this.prisma.$queryRaw<EditCountRow[]>`
      SELECT AVG(edits) AS "avgEdits" FROM (
        SELECT a."encounterId", COUNT(*) AS edits
        FROM "audit_logs" a
        JOIN "encounters" e ON e.id = a."encounterId"
        JOIN "users" u ON u.id = e."clinicianId"
        WHERE a.action IN ('note.edit', 'note.amend') AND u."clinicId" = ${clinicId}
        GROUP BY a."encounterId"
      ) per_encounter
    `;

    return {
      totalNotesSigned: Number(reviewTime?.total ?? 0),
      avgReviewTimeSeconds: reviewTime?.avgSeconds ?? null,
      avgSatisfactionRating: satisfaction._avg.satisfactionRating,
      satisfactionResponseCount: satisfaction._count.satisfactionRating,
      avgEditsPerNote: editCount?.avgEdits ?? null,
    };
  }
}
