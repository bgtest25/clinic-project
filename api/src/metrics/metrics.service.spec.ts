import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let service: MetricsService;

  beforeEach(() => {
    prisma = {
      $queryRawUnsafe: jest.fn(),
      $queryRaw: jest.fn(),
      clinicalNote: { aggregate: jest.fn() },
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    service = new MetricsService(prisma, usersService);
  });

  it('rejects viewing another clinic\'s metrics', async () => {
    await expect(service.summary('clinic-b', 'sub-1')).rejects.toThrow(
      "Cannot view another clinic's metrics",
    );
  });

  // $queryRaw's AVG() results come back from Prisma as Decimal objects, not
  // plain numbers — Decimal.toJSON() returns a string, so an unconverted
  // value here would silently ship a JSON string over the wire (e.g.
  // "avgEditsPerNote":"1") instead of a number. The frontend calls
  // .toFixed(1) on this field assuming it's a real number; on a string that
  // throws, and with no error boundary in the app that crashed the whole
  // /metrics page to a blank screen — found live 2026-08-16. Simulating the
  // Decimal here with a plain object whose toJSON returns a string, matching
  // the actual runtime shape confirmed against the real database.
  function fakeDecimal(value: string) {
    return { toJSON: () => value, valueOf: () => value, toString: () => value };
  }

  it('converts raw-query Decimal results to real numbers, not strings or Decimal objects', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ avgSeconds: fakeDecimal('1084.9772'), total: 5n }])
      .mockResolvedValueOnce([{ avgEdits: fakeDecimal('1') }]);
    prisma.clinicalNote.aggregate.mockResolvedValue({
      _avg: { satisfactionRating: 5 },
      _count: { satisfactionRating: 1 },
    });

    const result = await service.summary('clinic-a', 'sub-1');

    expect(typeof result.avgReviewTimeSeconds).toBe('number');
    expect(result.avgReviewTimeSeconds).toBeCloseTo(1084.9772);
    expect(typeof result.avgEditsPerNote).toBe('number');
    expect(result.avgEditsPerNote).toBe(1);
    expect(typeof result.totalNotesSigned).toBe('number');
    expect(result.totalNotesSigned).toBe(5);
  });

  it('returns null (not a stray Decimal or NaN) when there is no data yet', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ avgSeconds: null, total: 0n }])
      .mockResolvedValueOnce([{ avgEdits: null }]);
    prisma.clinicalNote.aggregate.mockResolvedValue({
      _avg: { satisfactionRating: null },
      _count: { satisfactionRating: 0 },
    });

    const result = await service.summary('clinic-a', 'sub-1');

    expect(result.avgReviewTimeSeconds).toBeNull();
    expect(result.avgEditsPerNote).toBeNull();
    expect(result.totalNotesSigned).toBe(0);
  });
});
