import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest
    .fn()
    .mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  DeleteObjectCommand: jest.fn(),
}));

describe('NotesService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let encountersService: any;
  let aiService: any;
  let service: NotesService;

  beforeEach(() => {
    prisma = {
      clinicalNote: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn(), createMany: jest.fn() },
      encounter: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      audioRecording: { findUnique: jest.fn(), update: jest.fn() },
      referralLetter: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    encountersService = {
      assertClinicOwnsEncounter: jest.fn().mockResolvedValue(undefined),
    };
    aiService = {
      generateAfterVisitSummary: jest.fn().mockResolvedValue('Sample AVS content'),
      generateReferralLetter: jest.fn().mockResolvedValue('Dear Cardiology Colleagues,\n\nReferral letter content...'),
    };
    service = new NotesService(prisma, usersService, encountersService, aiService);
  });

  describe('findLatest', () => {
    it('verifies clinic ownership before reading the note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        version: 1,
      });
      await service.findLatest('enc-1', 'sub-1');
      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('throws NotFoundException if no note exists yet', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue(null);
      await expect(service.findLatest('enc-1', 'sub-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('never reads the note if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(service.findLatest('enc-1', 'sub-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.clinicalNote.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    // update/sign/submitFeedback all route through findLatest first, which
    // is where the ownership check lives — this asserts that call-site
    // wiring directly rather than only trusting findLatest's own tests,
    // since a future refactor bypassing findLatest (e.g. "inline the query
    // for performance") would silently drop the check and these tests, if
    // they only mock prisma.clinicalNote.findFirst, would keep passing.
    it('checks clinic ownership before allowing an edit', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        version: 1,
        status: 'DRAFT',
        subjective: 'old',
      });
      prisma.clinicalNote.update.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });

      await service.update('enc-1', 'sub-1', { subjective: 'new' });

      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('never writes an edit if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(
        service.update('enc-1', 'sub-1', { subjective: 'new' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.clinicalNote.update).not.toHaveBeenCalled();
      expect(prisma.clinicalNote.create).not.toHaveBeenCalled();
    });

    it('updates the note in place while still a draft', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        version: 1,
        status: 'DRAFT',
        subjective: 'old',
      });
      prisma.clinicalNote.update.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });

      await service.update('enc-1', 'sub-1', { subjective: 'new' });

      expect(prisma.clinicalNote.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { subjective: 'new' },
      });
      expect(prisma.clinicalNote.create).not.toHaveBeenCalled();
      expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            action: 'note.edit',
            fieldChanged: 'subjective',
          }),
        ],
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
      prisma.clinicalNote.create.mockResolvedValue({
        id: 'note-2',
        version: 2,
        status: 'AMENDED',
      });

      const result = await service.update('enc-1', 'sub-1', {
        subjective: 'new',
      });

      expect(prisma.clinicalNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: 2,
          status: 'AMENDED',
          subjective: 'new',
        }),
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

      await service.update('enc-1', 'sub-1', { subjective: 'same' });

      expect(prisma.auditLog.createMany).not.toHaveBeenCalled();
    });
  });

  describe('sign', () => {
    it('checks clinic ownership before allowing a sign', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });
      prisma.audioRecording.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValueOnce([
        { id: 'note-1', status: 'SIGNED' },
      ]);

      await service.sign('enc-1', 'sub-1');

      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('never signs if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(service.sign('enc-1', 'sub-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects signing an already-signed note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
      });
      await expect(service.sign('enc-1', 'sub-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('signs a draft note and purges the raw audio', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });
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
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });
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
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });
      prisma.audioRecording.findUnique.mockResolvedValue({
        s3Key: 'audio/enc-1/x.webm',
        deletedAt: new Date(),
      });
      prisma.$transaction.mockResolvedValueOnce([
        { id: 'note-1', status: 'SIGNED' },
      ]);

      await service.sign('enc-1', 'sub-1');
      expect(prisma.audioRecording.update).not.toHaveBeenCalled();
    });
  });

  describe('submitFeedback', () => {
    it('checks clinic ownership before recording feedback', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'note-1', satisfactionRating: 4 },
      ]);

      await service.submitFeedback('enc-1', 'sub-1', { rating: 4 });

      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('never records feedback if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(
        service.submitFeedback('enc-1', 'sub-1', { rating: 4 } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects feedback for a note that is not yet signed', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });
      await expect(
        service.submitFeedback('enc-1', 'sub-1', { rating: 5 } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('records the rating and comment for a signed note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'note-1', satisfactionRating: 4 },
      ]);

      const result = await service.submitFeedback('enc-1', 'sub-1', {
        rating: 4,
        comment: 'Great',
      });

      expect(result).toEqual({ id: 'note-1', satisfactionRating: 4 });
    });
  });

  describe('getForExport', () => {
    it('checks clinic ownership before returning the note for export', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
      });
      prisma.encounter.findUniqueOrThrow.mockResolvedValue({ id: 'enc-1' });

      await service.getForExport('enc-1', 'sub-1');

      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('never reads the encounter if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new NotFoundException(),
      );
      await expect(service.getForExport('enc-1', 'sub-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.encounter.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('returns both the note and the encounter (with patient/clinician included)', async () => {
      const note = { id: 'note-1', status: 'SIGNED' };
      const encounter = {
        id: 'enc-1',
        patient: { name: 'Jane' },
        clinician: { name: 'Dr. Smith' },
      };
      prisma.clinicalNote.findFirst.mockResolvedValue(note);
      prisma.encounter.findUniqueOrThrow.mockResolvedValue(encounter);

      const result = await service.getForExport('enc-1', 'sub-1');

      expect(result).toEqual({ note, encounter });
      expect(prisma.encounter.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'enc-1' },
        include: { patient: true, clinician: true },
      });
    });
  });

  describe('generateAfterVisitSummary', () => {
    it('checks clinic ownership before generating AVS', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
        subjective: 'Cough',
        objective: '',
        assessment: 'URI',
        plan: 'Rest',
      });
      prisma.encounter.findUniqueOrThrow.mockResolvedValue({
        id: 'enc-1',
        visitDate: new Date('2026-09-07'),
        patient: { name: 'Jane Doe' },
        clinician: { clinic: { name: 'Test Clinic' } },
      });
      prisma.$transaction.mockResolvedValue([{ id: 'note-1', afterVisitSummary: 'Summary' }]);

      await service.generateAfterVisitSummary('enc-1', 'sub-1');

      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith('enc-1', 'clinic-a');
    });

    it('rejects AVS generation for unsigned notes', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });

      await expect(service.generateAfterVisitSummary('enc-1', 'sub-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('calls the AI service and saves the summary', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
        subjective: 'Cough for 3 days',
        objective: 'Vitals normal',
        assessment: 'Viral URI',
        plan: 'Rest and fluids',
      });
      prisma.encounter.findUniqueOrThrow.mockResolvedValue({
        id: 'enc-1',
        visitDate: new Date('2026-09-07'),
        patient: { name: 'Jane Doe' },
        clinician: { clinic: { name: 'Test Clinic' } },
      });
      prisma.$transaction.mockResolvedValue([{ id: 'note-1', afterVisitSummary: 'Sample AVS content' }]);

      await service.generateAfterVisitSummary('enc-1', 'sub-1');

      expect(aiService.generateAfterVisitSummary).toHaveBeenCalledWith({
        patientName: 'Jane Doe',
        visitDate: expect.any(String),
        clinicName: 'Test Clinic',
        subjective: 'Cough for 3 days',
        objective: 'Vitals normal',
        assessment: 'Viral URI',
        plan: 'Rest and fluids',
      });
    });
  });

  describe('getAfterVisitSummary', () => {
    it('returns the existing AVS if present', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
        afterVisitSummary: 'Existing summary',
      });

      const result = await service.getAfterVisitSummary('enc-1', 'sub-1');

      expect(result).toEqual({ afterVisitSummary: 'Existing summary' });
    });

    it('returns null AVS if not yet generated', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
        afterVisitSummary: null,
      });

      const result = await service.getAfterVisitSummary('enc-1', 'sub-1');

      expect(result).toEqual({ afterVisitSummary: null });
    });
  });

  describe('generateReferralLetter', () => {
    it('checks clinic ownership before generating referral', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
        subjective: 'Chest pain',
        objective: 'BP elevated',
        assessment: 'Hypertension',
        plan: 'Refer to cardiology',
      });
      prisma.encounter.findUniqueOrThrow.mockResolvedValue({
        id: 'enc-1',
        visitDate: new Date('2026-09-07'),
        patient: { name: 'Jane Doe', dateOfBirth: new Date('1980-01-01') },
        clinician: { name: 'Dr. Smith', clinic: { name: 'Test Clinic' } },
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'ref-1', specialty: 'Cardiology', letterContent: 'Dear Cardiology Colleagues...' },
      ]);

      await service.generateReferralLetter('enc-1', 'sub-1', {
        specialty: 'Cardiology',
        reason: 'Elevated BP, rule out secondary causes',
      });

      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith('enc-1', 'clinic-a');
    });

    it('rejects referral generation for unsigned notes', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'DRAFT',
      });

      await expect(
        service.generateReferralLetter('enc-1', 'sub-1', {
          specialty: 'Cardiology',
          reason: 'Evaluation needed',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('calls the AI service and saves the letter', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
        subjective: 'Chest pain for 2 weeks',
        objective: 'BP 150/95',
        assessment: 'Hypertension, uncontrolled',
        plan: 'Refer to cardiology',
      });
      prisma.encounter.findUniqueOrThrow.mockResolvedValue({
        id: 'enc-1',
        visitDate: new Date('2026-09-07'),
        patient: { name: 'Jane Doe', dateOfBirth: new Date('1980-01-01') },
        clinician: { name: 'Dr. Smith', clinic: { name: 'Test Clinic' } },
      });
      prisma.$transaction.mockResolvedValue([
        { id: 'ref-1', specialty: 'Cardiology', letterContent: 'Dear Cardiology Colleagues...' },
      ]);

      await service.generateReferralLetter('enc-1', 'sub-1', {
        specialty: 'Cardiology',
        reason: 'Elevated BP despite lifestyle modifications',
      });

      expect(aiService.generateReferralLetter).toHaveBeenCalledWith({
        patientName: 'Jane Doe',
        patientDob: expect.any(String),
        visitDate: expect.any(String),
        clinicName: 'Test Clinic',
        clinicianName: 'Dr. Smith',
        specialty: 'Cardiology',
        reason: 'Elevated BP despite lifestyle modifications',
        subjective: 'Chest pain for 2 weeks',
        objective: 'BP 150/95',
        assessment: 'Hypertension, uncontrolled',
        plan: 'Refer to cardiology',
      });
    });
  });

  describe('getReferralLetters', () => {
    it('returns all referral letters for the note', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
      });
      prisma.referralLetter.findMany.mockResolvedValue([
        { id: 'ref-1', specialty: 'Cardiology', reason: 'HTN', letterContent: 'Letter 1' },
        { id: 'ref-2', specialty: 'Nephrology', reason: 'CKD', letterContent: 'Letter 2' },
      ]);

      const result = await service.getReferralLetters('enc-1', 'sub-1');

      expect(result).toHaveLength(2);
      expect(prisma.referralLetter.findMany).toHaveBeenCalledWith({
        where: { noteId: 'note-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array if no letters exist', async () => {
      prisma.clinicalNote.findFirst.mockResolvedValue({
        id: 'note-1',
        status: 'SIGNED',
      });
      prisma.referralLetter.findMany.mockResolvedValue([]);

      const result = await service.getReferralLetters('enc-1', 'sub-1');

      expect(result).toEqual([]);
    });
  });
});
