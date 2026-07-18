import { Module } from '@nestjs/common';
import { EncountersModule } from '../encounters/encounters.module';
import { UsersModule } from '../users/users.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [UsersModule, EncountersModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
