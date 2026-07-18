import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  DeleteObjectCommand: jest.fn(),
}));

describe('NotesService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let encountersService: any;
  let service: NotesService;

  beforeEach(() => {
    prisma = {
      clinicalNote: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn(), createMany: jest.fn() },
      encounter: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      audioRecording: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    encountersService = { assertClinicOwnsEncounter: jest.fn().mockResolvedValue(undefined) };
    service = new NotesService(prisma, usersService, encountersService);
  });

  describe('findLatest', () => {
    it('verifies clinic ownership before reading the note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', version: 1 });
      await service.findLatest('enc-1', 'sub-1');
      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith('enc-1', 'clinic-a');
    });

    it('throws NotFoundException if no note exists yet', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(null);
      await expect(service.findLatest('enc-1', 'sub-1')).rejects.toThrow(NotFoundException);
    });

    it('never reads the note if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(new NotFoundException());
      await expect(service.findLatest('enc-1', 'sub-1')).rejects.toThrow(NotFoundException);
      expect(prisma.clinicalNote.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the note in place while still a draft', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        version: 1,
        status: 'DRAFT',
        subjective: 'old',
      });
      prisma.clinicalNote.update.mockResolvedValue({ id: 'note-1', status: 'DRAFT' });

      await service.update('enc-1', 'sub-1', { subjective: 'new' } as any);

      expect(prisma.clinicalNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { subjective: 'new' },
      });
      expect(prisma.clinicalNote.create).not.toHaveBeenCalled();
      expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ action: 'note.edit', fieldChanged: 'subjective' })],
      });
    });

    it('forks a new versioned amendment instead of mutating a signed note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        version: 1,
        status: 'SIGNED',
        subjective: 'old',
        objective: 'o',
        assessment: 'a',
        plan: 'p',
        suggestedCodes: null,
      });
      prisma.clinicalNote.create.mockResolvedValue({ id: 'note-2', version: 2, status: 'AMENDED' });

      const result = await service.update('enc-1', 'sub-1', { subjective: 'new' } as any);

      expect(prisma.clinicalNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 2, status: 'AMENDED', subjective: 'new' }),
      });
      expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'note-2', version: 2, status: 'AMENDED' });
      expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ action: 'note.amend' })],
      });
    });

    it('writes no audit entries when nothing actually changed', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        version: 1,
        status: 'DRAFT',
        subjective: 'same',
      });
      prisma.clinicalNote.update.mockResolvedValue({ id: 'note-1' });

      await service.update('enc-1', 'sub-1', { subjective: 'same' } as any);

      expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
    });
  });

  describe('sign', () => {
    it('rejects signing an already-signed note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'SIGNED' });
      await expect(service.sign('enc-1', 'sub-1')).rejects.toThrow(ForbiddenException);
    });

    it('signs a draft note and purges the raw audio', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'DRAFT' });
      prisma.audioRecording.findUnique.mockResolvedValue({
        s3Key: 'audio/enc-1/x.webm',
        deletedAt: null,
      });
      prisma.$transaction
        .mockResolvedValueOnce([{ id: 'note-1', status: 'SIGNED' }])
        .mockResolvedValueOnce([{}, {}]);

      const result = await service.sign('enc-1', 'sub-1');

      expect(result).toEqual({ id: 'note-1', status: 'SIGNED' });
      expect(prisma.audioRecording.update).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('does not let a failed audio purge block the note from being signed', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'DRAFT' });
      prisma.audioRecording.findUnique.mockResolvedValue({
        s3Key: 'audio/enc-1/x.webm',
        deletedAt: null,
      });
      prisma.$transaction
        .mockResolvedValueOnce([{ id: 'note-1', status: 'SIGNED' }])
        .mockRejectedValueOnce(new Error('boom'));

      const result = await service.sign('enc-1', 'sub-1');
      expect(result).toEqual({ id: 'note-1', status: 'SIGNED' });
    });

    it('skips the purge entirely if the audio was already purged', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'DRAFT' });
      prisma.audioRecording.findUnique.mockResolvedValue({
        s3Key: 'audio/enc-1/x.webm',
        deletedAt: new Date(),
      });
      prisma.$transaction.mockResolvedValueOnce([{ id: 'note-1', status: 'SIGNED' }]);

      await service.sign('enc-1', 'sub-1');
      expect(prisma.audioRecording.update).not.toHaveBeenCalled();
    });
  });

  describe('submitFeedback', () => {
    it('rejects feedback for a note that is not yet signed', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'DRAFT' });
      await expect(service.submitFeedback('enc-1', 'sub-1', { rating: 5 } as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('records the rating and comment for a signed note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({ id: 'note-1', status: 'SIGNED' });
      prisma.$transaction.mockResolvedValue([{ id: 'note-1', satisfactionRating: 4 }]);

      const result = await service.submitFeedback('enc-1', 'sub-1', {
        rating: 4,
        comment: 'Great',
      } as any);

      expect(result).toEqual({ id: 'note-1', satisfactionRating: 4 });
    });
  });
});
