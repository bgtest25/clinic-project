import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly cognito = new CognitoIdentityProviderClient({});

  constructor(private readonly prisma: PrismaService) {}

  // The chokepoint every clinic-scoped service calls first on every request —
  // so gating a deactivated account here blocks it everywhere in one place,
  // with no new query and no per-route wiring. This also covers the gap left
  // by AdminUserGlobalSignOutCommand: that call only revokes refresh tokens,
  // so an already-issued access token would otherwise keep working for its
  // remaining TTL (CognitoJwtVerifier only checks signature/expiry, it never
  // calls out to Cognito to check revocation).
  async findByCognitoSub(cognitoSub: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { cognitoSub } });
    if (user.deactivatedAt) {
      throw new UnauthorizedException('This account has been deactivated');
    }
    return user;
  }

  // Admin-only clinic roster (enforced by the controller's @Roles('admin')).
  async findAll(cognitoSub: string) {
    const actor = await this.findByCognitoSub(cognitoSub);
    return this.prisma.user.findMany({
      where: { clinicId: actor.clinicId },
      orderBy: { name: 'asc' },
    });
  }

  // Admin-provisioned only (selfSignUpEnabled: false on the pool) — creates
  // the Cognito account first (temp password + invite email are Cognito's
  // own default behavior, no email infra of our own needed), then mirrors it
  // into Postgres. Cognito user pool groups are the actual authorization
  // source (see RolesGuard) — this User.role column is a display/query
  // convenience kept in sync with the group, not itself authoritative.
  async invite(dto: CreateUserDto) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    const created = await this.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: dto.email,
        UserAttributes: [
          { Name: 'email', Value: dto.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: dto.name },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );

    const cognitoSub = created.User?.Attributes?.find((attr) => attr.Name === 'sub')?.Value;
    if (!cognitoSub) {
      throw new InternalServerErrorException('Cognito did not return a sub for the new user');
    }

    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: dto.email,
        GroupName: dto.role === 'ADMIN' ? 'admin' : 'clinician',
      }),
    );

    try {
      return await this.prisma.user.create({
        data: {
          cognitoSub,
          email: dto.email,
          name: dto.name,
          role: dto.role,
          clinicId: dto.clinicId,
        },
      });
    } catch (err) {
      // Don't leave a Cognito account with no matching User row (e.g. a
      // duplicate email or bad clinicId failing the DB write) — undo the
      // Cognito side rather than leaving an orphaned, unusable invite.
      await this.cognito
        .send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: dto.email }))
        .catch(() => {});
      throw err;
    }
  }

  // Deactivate, never hard-delete — deleting the row would orphan
  // ClinicalNote.signedById and AuditLog.actorId, corrupting the legal/audit
  // record. Admin-only and clinic-scoped by the controller/here; 404s (not
  // 403) on a cross-clinic target, same convention as everywhere else.
  async deactivate(cognitoSub: string, targetUserId: string) {
    const actor = await this.findByCognitoSub(cognitoSub);

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, clinicId: actor.clinicId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === actor.id) {
      throw new BadRequestException('Cannot deactivate your own account');
    }
    if (target.deactivatedAt) return target;

    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    // Cognito side first: AdminDisableUserCommand blocks all future logins;
    // AdminUserGlobalSignOutCommand invalidates already-issued refresh tokens
    // so an active session can't silently renew. Both are safe to retry if
    // the Postgres write below fails — "disabled in Cognito but not yet
    // flagged in Postgres" is fail-safe (more restrictive), not fail-open.
    await this.cognito.send(
      new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: target.email }),
    );
    await this.cognito.send(
      new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId, Username: target.email }),
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { deactivatedAt: new Date(), deactivatedById: actor.id },
      }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, targetUserId, action: 'user.deactivated' },
      }),
    ]);

    return updated;
  }

  // Cognito's admin API has no way to forcibly un-associate a verified TOTP
  // device — AdminSetUserMFAPreference only changes a preference flag, not
  // the underlying enrollment (confirmed live 2026-08-16: an account kept
  // returning the SOFTWARE_TOKEN_MFA challenge, not MFA_SETUP, after calling
  // it). Delete-and-recreate is the only way to force a genuinely fresh MFA
  // enrollment, which means this also always issues a new temporary
  // password via the same branded Cognito invite email the original invite
  // used — not a silent, MFA-only reset. The frontend surfaces that.
  async resetMfa(cognitoSub: string, targetUserId: string) {
    const actor = await this.findByCognitoSub(cognitoSub);
    if (targetUserId === actor.id) {
      // Deleting-and-recreating your own Cognito user mid-session would
      // orphan the JWT you're currently authenticated with — same
      // self-service dead end as self-deactivation, and it can't even help
      // real lockout recovery, since reaching this endpoint already
      // requires a valid session.
      throw new BadRequestException('Cannot reset your own MFA — ask another admin');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, clinicId: actor.clinicId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.deactivatedAt) {
      throw new BadRequestException('Cannot reset MFA for a deactivated account');
    }

    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    await this.cognito.send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: target.email }),
    );

    const created = await this.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: target.email,
        UserAttributes: [
          { Name: 'email', Value: target.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: target.name },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );

    const newCognitoSub = created.User?.Attributes?.find((attr) => attr.Name === 'sub')?.Value;
    if (!newCognitoSub) {
      throw new InternalServerErrorException('Cognito did not return a sub for the recreated user');
    }

    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: target.email,
        GroupName: target.role === 'ADMIN' ? 'admin' : 'clinician',
      }),
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { cognitoSub: newCognitoSub },
      }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, targetUserId, action: 'user.mfa_reset' },
      }),
    ]);

    return updated;
  }

  // Symmetrical undo — admin-only, same clinic-scoping, idempotent.
  async reactivate(cognitoSub: string, targetUserId: string) {
    const actor = await this.findByCognitoSub(cognitoSub);

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, clinicId: actor.clinicId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!target.deactivatedAt) return target;

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    await this.cognito.send(
      new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: target.email }),
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { deactivatedAt: null, deactivatedById: null },
      }),
      this.prisma.auditLog.create({
        data: { actorId: actor.id, targetUserId, action: 'user.reactivated' },
      }),
    ]);

    return updated;
  }
}
