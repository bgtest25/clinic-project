import { RecordingsService } from './recordings.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://example-bucket.s3.amazonaws.com/signed-url'),
}));
jest.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      executionArn: 'arn:aws:states:us-east-1:123:execution:x',
    }),
  })),
  StartExecutionCommand: jest.fn(),
}));

describe('RecordingsService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let encountersService: any;
  let service: RecordingsService;

  beforeEach(() => {
    prisma = {
      audioRecording: {
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      encounter: { update: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    encountersService = {
      assertClinicOwnsEncounter: jest.fn().mockResolvedValue(undefined),
    };
    service = new RecordingsService(prisma, usersService, encountersService);
  });

  describe('createUploadUrl', () => {
    it('checks clinic ownership before minting an upload URL', async () => {
      prisma.audioRecording.upsert.mockResolvedValue({});
      await service.createUploadUrl('enc-1', 'sub-1');
      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('never mints an upload URL or writes a recording row if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new Error('not found'),
      );
      await expect(service.createUploadUrl('enc-1', 'sub-1')).rejects.toThrow();
      expect(prisma.audioRecording.upsert).not.toHaveBeenCalled();
    });

    it('scopes the S3 key to the encounter and persists it', async () => {
      prisma.audioRecording.upsert.mockResolvedValue({});
      const result = await service.createUploadUrl('enc-1', 'sub-1');

      expect(result.uploadUrl).toBe(
        'https://example-bucket.s3.amazonaws.com/signed-url',
      );
      expect(result.s3Key).toMatch(/^audio\/enc-1\//);
      expect(prisma.audioRecording.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounterId: 'enc-1' },
          create: expect.objectContaining({ encounterId: 'enc-1' }),
        }),
      );
    });
  });

  describe('completeUpload', () => {
    beforeEach(() => {
      prisma.audioRecording.findUniqueOrThrow.mockResolvedValue({
        s3Key: 'audio/enc-1/x.webm',
      });
    });

    it('checks clinic ownership before starting the pipeline', async () => {
      await service.completeUpload('enc-1', 'sub-1');
      expect(encountersService.assertClinicOwnsEncounter).toHaveBeenCalledWith(
        'enc-1',
        'clinic-a',
      );
    });

    it('never starts the pipeline or touches the encounter if the clinic-ownership check fails', async () => {
      encountersService.assertClinicOwnsEncounter.mockRejectedValue(
        new Error('not found'),
      );
      await expect(service.completeUpload('enc-1', 'sub-1')).rejects.toThrow();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      const sfnSend = (service as any).sfn.send;
      expect(sfnSend).not.toHaveBeenCalled();
    });

    it('marks the encounter as transcribing and starts the state machine', async () => {
      const result = await service.completeUpload('enc-1', 'sub-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      const sfnSend = (service as any).sfn.send;
      expect(sfnSend).toHaveBeenCalled();
      expect(result).toHaveProperty('executionArn');
    });
  });
});
