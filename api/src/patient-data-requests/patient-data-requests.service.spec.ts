import { NotFoundException } from '@nestjs/common';
import { PatientDataRequestsService } from './patient-data-requests.service';

describe('PatientDataRequestsService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let patientsService: any;
  let service: PatientDataRequestsService;

  beforeEach(() => {
    prisma = {
      patientDataRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    patientsService = { assertClinicOwnsPatient: jest.fn().mockResolvedValue(undefined) };
    service = new PatientDataRequestsService(prisma, usersService, patientsService);
  });

  describe('create', () => {
    it('checks clinic ownership before logging the request', async () => {
      prisma.$transaction.mockResolvedValue([{ id: 'req-1' }, {}]);
      await service.create('sub-1', 'patient-1', { requestType: 'deletion' } as any);
      expect(patientsService.assertClinicOwnsPatient).toHaveBeenCalledWith('patient-1', 'clinic-a');
    });

    it('never logs a request if the clinic-ownership check fails', async () => {
      patientsService.assertClinicOwnsPatient.mockRejectedValue(new NotFoundException());
      await expect(
        service.create('sub-1', 'patient-x', { requestType: 'deletion' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes both the request and an audit log entry', async () => {
      prisma.$transaction.mockResolvedValue([{ id: 'req-1' }, {}]);
      await service.create('sub-1', 'patient-1', { requestType: 'amendment', reason: 'typo' } as any);

      expect(prisma.patientDataRequest.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-1',
          requestType: 'amendment',
          reason: 'typo',
          loggedById: 'user-1',
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-1',
          actorId: 'user-1',
          action: 'patient.data_request_logged',
          newValue: 'amendment',
        },
      });
    });
  });

  describe('resolve', () => {
    it('throws NotFoundException for an unknown requestId even within the right clinic', async () => {
      prisma.patientDataRequest.findFirst.mockResolvedValue(null);
      await expect(
        service.resolve('sub-1', 'patient-1', 'req-missing', { status: 'approved' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates status and writes an audit log recording the transition', async () => {
      prisma.patientDataRequest.findFirst.mockResolvedValue({ id: 'req-1', status: 'pending' });
      prisma.$transaction.mockResolvedValue([{ id: 'req-1', status: 'denied' }, {}]);

      await service.resolve('sub-1', 'patient-1', 'req-1', {
        status: 'denied',
        resolutionNote: 'Retention period not yet elapsed',
      } as any);

      expect(prisma.patientDataRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: {
          status: 'denied',
          resolutionNote: 'Retention period not yet elapsed',
          resolvedAt: expect.any(Date),
          resolvedById: 'user-1',
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          patientId: 'patient-1',
          actorId: 'user-1',
          action: 'patient.data_request_resolved',
          fieldChanged: 'status',
          oldValue: 'pending',
          newValue: 'denied',
        },
      });
    });
  });
});
