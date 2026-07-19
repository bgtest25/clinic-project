import { NotFoundException } from '@nestjs/common';
import { ClinicsService } from './clinics.service';

describe('ClinicsService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let service: ClinicsService;

  beforeEach(() => {
    prisma = {
      clinic: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    service = new ClinicsService(prisma, usersService);
  });

  it("findAll only ever returns the caller's own clinic", async () => {
    prisma.clinic.findMany.mockResolvedValue([{ id: 'clinic-a' }]);
    await service.findAll('sub-1');
    expect(prisma.clinic.findMany).toHaveBeenCalledWith({ where: { id: 'clinic-a' } });
  });

  it('findOne throws NotFoundException for a clinic other than the caller\'s own', async () => {
    await expect(service.findOne('sub-1', 'clinic-b')).rejects.toThrow(NotFoundException);
    expect(prisma.clinic.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("findOne returns the clinic when it matches the caller's own", async () => {
    const clinic = { id: 'clinic-a', name: 'Test Clinic' };
    prisma.clinic.findUniqueOrThrow.mockResolvedValue(clinic);
    await expect(service.findOne('sub-1', 'clinic-a')).resolves.toBe(clinic);
  });
});
