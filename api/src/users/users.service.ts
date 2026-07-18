import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByCognitoSub(cognitoSub: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { cognitoSub } });
  }
}
