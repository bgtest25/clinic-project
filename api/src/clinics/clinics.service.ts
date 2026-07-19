import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  create(dto: CreateClinicDto) {
    return this.prisma.clinic.create({ data: dto });
  }

  // Every user belongs to exactly one clinic and there's no superadmin
  // concept in this system, so "all clinics" is always just the caller's own.
  async findAll(cognitoSub: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    return this.prisma.clinic.findMany({ where: { id: actor.clinicId } });
  }

  async findOne(cognitoSub: string, id: string) {
    const actor = await this.usersService.findByCognitoSub(cognitoSub);
    // 404, not 403 — same convention as EncountersService.assertClinicOwnsEncounter:
    // don't confirm to a caller from another clinic that the ID even exists.
    if (id !== actor.clinicId) throw new NotFoundException('Clinic not found');
    return this.prisma.clinic.findUniqueOrThrow({ where: { id } });
  }
}
