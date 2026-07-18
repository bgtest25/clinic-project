import { NotFoundException } from '@nestjs/common';
import { EncountersService } from './encounters.service';

describe('EncountersService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let service: EncountersService;

  beforeEach(() => {
    prisma = {
      patient: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      encounter: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    service = new EncountersService(prisma, usersService);
  });

  describe('create', () => {
    it('rejects a patient that belongs to a different clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.create('sub-1', { patientId: 'p-other-clinic', clinicianId: 'c-1' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.create).not.toHaveBeenCalled();
    });

    it('rejects a clinician that belongs to a different clinic', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'p-1', clinicId: 'clinic-a' });
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create('sub-1', { patientId: 'p-1', clinicianId: 'c-other-clinic' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.encounter.create).not.toHaveBeenCalled();
    });

    it("creates the encounter once patient and clinician both belong to the caller's clinic", async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'p-1', clinicId: 'clinic-a' });
      prisma.user.findFirst.mockResolvedValue({ id: 'c-1', clinicId: 'clinic-a' });
      prisma.encounter.create.mockResolvedValue({ id: 'enc-1' });

      const result = await service.create('sub-1', { patientId: 'p-1', clinicianId: 'c-1' } as any);
      expect(result).toEqual({ id: 'enc-1' });
    });
  });

  describe('findAll', () => {
    it("always filters by the caller's own clinic, regardless of a clinicianId filter", async () => {
      prisma.encounter.findMany.mockResolvedValue([]);
      await service.findAll('sub-1', 'some-clinician');
      expect(prisma.encounter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clinician: { clinicId: 'clinic-a' }, clinicianId: 'some-clinician' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it("throws NotFoundException for an encounter outside the caller's clinic", async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);
      await expect(service.findOne('sub-1', 'enc-other')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertClinicOwnsEncounter', () => {
    it('throws when the encounter does not belong to the given clinic', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);
      await expect(service.assertClinicOwnsEncounter('enc-1', 'clinic-b')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resolves silently when the encounter belongs to the given clinic', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      await expect(service.assertClinicOwnsEncounter('enc-1', 'clinic-a')).resolves.toBeUndefined();
    });
  });
});
