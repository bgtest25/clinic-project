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
      transcript: { findUnique: jest.fn(), update: jest.fn() },
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

  describe('updateSpeakerLabels', () => {
    const diarizedTranscript = {
      encounterId: 'enc-1',
      diarizedSegments: [
        { speaker: 'spk_0', text: 'hi' },
        { speaker: 'spk_1', text: 'hello' },
      ],
      speakerLabels: null,
    };

    it('checks clinic ownership before touching the transcript', async () => {
      prisma.encounter.findFirst.mockResolvedValue(null);
      await expect(
        service.updateSpeakerLabels('sub-1', 'enc-1', [{ speaker: 'spk_0', label: 'Clinician' }]),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.transcript.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if the encounter has no transcript yet', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.transcript.findUnique.mockResolvedValue(null);
      await expect(
        service.updateSpeakerLabels('sub-1', 'enc-1', [{ speaker: 'spk_0', label: 'Clinician' }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a speaker key that was never actually diarized', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.transcript.findUnique.mockResolvedValue(diarizedTranscript);
      await expect(
        service.updateSpeakerLabels('sub-1', 'enc-1', [{ speaker: 'spk_9', label: 'Clinician' }]),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.transcript.update).not.toHaveBeenCalled();
    });

    it('writes the label for a real speaker key', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.transcript.findUnique.mockResolvedValue(diarizedTranscript);
      prisma.transcript.update.mockResolvedValue({ ...diarizedTranscript, speakerLabels: { spk_0: 'Clinician' } });

      await service.updateSpeakerLabels('sub-1', 'enc-1', [{ speaker: 'spk_0', label: 'Clinician' }]);

      expect(prisma.transcript.update).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
        data: { speakerLabels: { spk_0: 'Clinician' } },
      });
    });

    it("merges into existing labels instead of wiping the other speaker's assignment", async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.transcript.findUnique.mockResolvedValue({
        ...diarizedTranscript,
        speakerLabels: { spk_0: 'Clinician' },
      });
      prisma.transcript.update.mockResolvedValue({});

      await service.updateSpeakerLabels('sub-1', 'enc-1', [{ speaker: 'spk_1', label: 'Jane Doe' }]);

      expect(prisma.transcript.update).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
        data: { speakerLabels: { spk_0: 'Clinician', spk_1: 'Jane Doe' } },
      });
    });

    it('overwrites a previous label for the same speaker rather than duplicating it', async () => {
      prisma.encounter.findFirst.mockResolvedValue({ id: 'enc-1' });
      prisma.transcript.findUnique.mockResolvedValue({
        ...diarizedTranscript,
        speakerLabels: { spk_0: 'Speaker 1' },
      });
      prisma.transcript.update.mockResolvedValue({});

      await service.updateSpeakerLabels('sub-1', 'enc-1', [{ speaker: 'spk_0', label: 'Clinician' }]);

      expect(prisma.transcript.update).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
        data: { speakerLabels: { spk_0: 'Clinician' } },
      });
    });
  });
});
