import { Module } from '@nestjs/common';
import { TranscriptionGateway } from './transcription.gateway';
import { TranscriptionStreamService } from './transcription-stream.service';
import { TranscriptionController } from './transcription.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { EncountersModule } from '../encounters/encounters.module';

@Module({
  imports: [PrismaModule, UsersModule, EncountersModule],
  providers: [TranscriptionGateway, TranscriptionStreamService],
  controllers: [TranscriptionController],
  exports: [TranscriptionStreamService],
})
export class TranscriptionModule {}
