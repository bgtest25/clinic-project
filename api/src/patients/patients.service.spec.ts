import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  const actor = { id: 'user-1', clinicId: 'clinic-a' };
  let prisma: any;
  let usersService: any;
  let service: PatientsService;

  beforeEach(() => {
    prisma = {
      patient: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    usersService = { findByCognitoSub: jest.fn().mockResolvedValue(actor) };
    service = new PatientsService(prisma, usersService);
  });

  it("creates a patient scoped to the caller's own clinic, ignoring any client-supplied clinicId", async () => {
    prisma.patient.create.mockResolvedValue({ id: 'patient-1' });

    await service.create('sub-1', {
      name: 'Jane',
      dateOfBirth: '1990-01-01',
      clinicId: 'clinic-b',
    } as any);

    expect(prisma.patient.create).toHaveBeenCalledWith({
      data: { name: 'Jane', dateOfBirth: new Date('1990-01-01'), clinicId: 'clinic-a' },
    });
  });

  it("findAll only ever queries the caller's own clinic", async () => {
    prisma.patient.findMany.mockResolvedValue([]);
    await service.findAll('sub-1');
    expect(prisma.patient.findMany).toHaveBeenCalledWith({ where: { clinicId: 'clinic-a' } });
  });

  it('findOne throws NotFoundException for a patient in a different clinic', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);
    await expect(service.findOne('sub-1', 'patient-in-other-clinic')).rejects.toThrow(NotFoundException);
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-in-other-clinic', clinicId: 'clinic-a' },
    });
  });

  it("findOne returns the patient when it belongs to the caller's clinic", async () => {
    const patient = { id: 'patient-1', clinicId: 'clinic-a' };
    prisma.patient.findFirst.mockResolvedValue(patient);
    await expect(service.findOne('sub-1', 'patient-1')).resolves.toBe(patient);
  });

  it('update throws NotFoundException (and never writes) for a patient in a different clinic', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);
    await expect(service.update('sub-1', 'patient-x', { name: 'New' } as any)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.patient.update).not.toHaveBeenCalled();
  });
});
