import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [UsersModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
