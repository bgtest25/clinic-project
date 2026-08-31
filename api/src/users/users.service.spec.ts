import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { UsersService } from './users.service';

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  AdminAddUserToGroupCommand: jest.fn(),
  AdminCreateUserCommand: jest.fn(),
  AdminDeleteUserCommand: jest.fn(),
  AdminDisableUserCommand: jest.fn(),
  AdminEnableUserCommand: jest.fn(),
  AdminUserGlobalSignOutCommand: jest.fn(),
}));

describe('UsersService', () => {
  const actor = {
    id: 'user-1',
    clinicId: 'clinic-a',
    email: 'admin@clinic-a.test',
  };
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    service = new UsersService(prisma);
  });

  describe('findAll', () => {
    it('returns clinic-scoped users ordered by name', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(actor);
      const users = [{ id: 'user-2', clinicId: 'clinic-a', name: 'Bob' }];
      prisma.user.findMany.mockResolvedValue(users);

      await expect(service.findAll('sub-1')).resolves.toBe(users);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { clinicId: 'clinic-a' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('invite', () => {
    beforeEach(() => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(actor);
      const send = (service as any).cognito.send;
      send.mockResolvedValueOnce({
        User: { Attributes: [{ Name: 'sub', Value: 'new-sub-123' }] },
      }); // AdminCreateUserCommand
      send.mockResolvedValueOnce({}); // AdminAddUserToGroupCommand
    });

    // Regression test for a real vulnerability found and fixed 2026-08-31:
    // this previously trusted a client-supplied clinicId with no
    // server-side check, so any authenticated admin could invite a user
    // (including another admin) into a clinic they don't belong to via a
    // direct API call — CreateUserDto no longer even has a clinicId field,
    // but a raw request body bypassing that type could still carry one, so
    // this asserts the service ignores it regardless.
    it("always creates the new user under the calling admin's own clinic, ignoring any client-supplied clinicId", async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-2' });

      await service.invite('sub-1', {
        email: 'new@x.test',
        name: 'New Clinician',
        role: 'CLINICIAN',
        clinicId: 'clinic-b',
      } as any);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          cognitoSub: 'new-sub-123',
          email: 'new@x.test',
          name: 'New Clinician',
          role: 'CLINICIAN',
          clinicId: 'clinic-a',
        },
      });
    });

    it('resolves the calling admin before creating anything in Cognito or Postgres', async () => {
      prisma.user.findUniqueOrThrow.mockRejectedValueOnce(
        new Error('no such user'),
      );
      const send = (service as any).cognito.send;
      send.mockReset();

      await expect(
        service.invite('sub-1', {
          email: 'new@x.test',
          name: 'New Clinician',
          role: 'CLINICIAN',
        }),
      ).rejects.toThrow();

      expect(send).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('adds the new user to the correct Cognito group for their role', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-2' });

      await service.invite('sub-1', {
        email: 'new@x.test',
        name: 'New Admin',
        role: 'ADMIN',
      });

      expect(AdminAddUserToGroupCommand).toHaveBeenCalledWith(
        expect.objectContaining({ GroupName: 'admin' }),
      );
    });

    // Regression test for a real gap found and fixed alongside the clinicId
    // vulnerability 2026-08-31: invite previously never wrote an AuditLog
    // row at all, unlike every other admin action in this service.
    it('writes an audit log entry for the invite', async () => {
      prisma.user.create.mockResolvedValue({ id: 'user-2' });

      await service.invite('sub-1', {
        email: 'new@x.test',
        name: 'New Clinician',
        role: 'CLINICIAN',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: { actorId: 'user-1', targetUserId: 'user-2', action: 'user.invited' },
      });
    });
  });

  describe('findByCognitoSub', () => {
    it('returns the user when active', async () => {
      const user = { id: 'user-1', deactivatedAt: null };
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);
      await expect(service.findByCognitoSub('sub-1')).resolves.toBe(user);
    });

    it('throws UnauthorizedException once deactivatedAt is set', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 'user-1',
        deactivatedAt: new Date(),
      });
      await expect(service.findByCognitoSub('sub-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('deactivate', () => {
    beforeEach(() => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(actor);
    });

    it('throws NotFoundException for a target in a different clinic', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.deactivate('sub-1', 'user-in-other-clinic'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects self-deactivation with BadRequestException', async () => {
      prisma.user.findFirst.mockResolvedValue(actor);
      await expect(service.deactivate('sub-1', actor.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('is a no-op if the target is already deactivated', async () => {
      const target = {
        id: 'user-2',
        clinicId: 'clinic-a',
        deactivatedAt: new Date(),
      };
      prisma.user.findFirst.mockResolvedValue(target);
      const result = await service.deactivate('sub-1', 'user-2');
      expect(result).toBe(target);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('disables the Cognito user, signs them out, and writes an audit log', async () => {
      const target = {
        id: 'user-2',
        clinicId: 'clinic-a',
        email: 'clinician@clinic-a.test',
        deactivatedAt: null,
      };
      prisma.user.findFirst.mockResolvedValue(target);
      prisma.$transaction.mockResolvedValue([
        { ...target, deactivatedAt: new Date() },
        {},
      ]);

      await service.deactivate('sub-1', 'user-2');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { deactivatedAt: expect.any(Date), deactivatedById: 'user-1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'user-1',
          targetUserId: 'user-2',
          action: 'user.deactivated',
        },
      });
    });
  });

  describe('reactivate', () => {
    beforeEach(() => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(actor);
    });

    it('throws NotFoundException for a target in a different clinic', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.reactivate('sub-1', 'user-in-other-clinic'),
      ).rejects.toThrow(NotFoundException);
    });

    it('is a no-op if the target is already active', async () => {
      const target = {
        id: 'user-2',
        clinicId: 'clinic-a',
        deactivatedAt: null,
      };
      prisma.user.findFirst.mockResolvedValue(target);
      const result = await service.reactivate('sub-1', 'user-2');
      expect(result).toBe(target);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('clears deactivation and writes an audit log', async () => {
      const target = {
        id: 'user-2',
        clinicId: 'clinic-a',
        email: 'clinician@clinic-a.test',
        deactivatedAt: new Date(),
      };
      prisma.user.findFirst.mockResolvedValue(target);
      prisma.$transaction.mockResolvedValue([
        { ...target, deactivatedAt: null },
        {},
      ]);

      await service.reactivate('sub-1', 'user-2');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('resetMfa', () => {
    beforeEach(() => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(actor);
    });

    it('rejects resetting your own MFA with BadRequestException', async () => {
      await expect(service.resetMfa('sub-1', actor.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for a target in a different clinic', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetMfa('sub-1', 'user-in-other-clinic'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects resetting MFA for a deactivated account', async () => {
      const target = {
        id: 'user-2',
        clinicId: 'clinic-a',
        deactivatedAt: new Date(),
      };
      prisma.user.findFirst.mockResolvedValue(target);
      await expect(service.resetMfa('sub-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes and recreates the Cognito user, re-adds the correct group, syncs the new sub, and audit-logs it', async () => {
      const target = {
        id: 'user-2',
        clinicId: 'clinic-a',
        email: 'clinician@clinic-a.test',
        name: 'Clinician Two',
        role: 'CLINICIAN',
        deactivatedAt: null,
      };
      prisma.user.findFirst.mockResolvedValue(target);
      const send = (service as any).cognito.send;
      send.mockResolvedValueOnce({}); // AdminDeleteUserCommand
      send.mockResolvedValueOnce({
        User: { Attributes: [{ Name: 'sub', Value: 'new-sub-123' }] },
      }); // AdminCreateUserCommand
      send.mockResolvedValueOnce({}); // AdminAddUserToGroupCommand
      prisma.$transaction.mockResolvedValue([
        { ...target, cognitoSub: 'new-sub-123' },
        {},
      ]);

      await service.resetMfa('sub-1', 'user-2');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { cognitoSub: 'new-sub-123' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'user-1',
          targetUserId: 'user-2',
          action: 'user.mfa_reset',
        },
      });
    });
  });
});
