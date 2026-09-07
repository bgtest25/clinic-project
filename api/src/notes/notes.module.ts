import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EncountersModule } from '../encounters/encounters.module';
import { UsersModule } from '../users/users.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [UsersModule, EncountersModule, AiModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
