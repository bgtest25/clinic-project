import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClinicDto) {
    return this.prisma.clinic.create({ data: dto });
  }

  findAll() {
    return this.prisma.clinic.findMany();
  }

  findOne(id: string) {
    return this.prisma.clinic.findUniqueOrThrow({ where: { id } });
  }
}
