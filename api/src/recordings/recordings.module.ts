import { Module } from '@nestjs/common';
import { EncountersModule } from '../encounters/encounters.module';
import { UsersModule } from '../users/users.module';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';

@Module({
  imports: [UsersModule, EncountersModule],
  controllers: [RecordingsController],
  providers: [RecordingsService],
})
export class RecordingsModule {}
