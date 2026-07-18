import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [UsersModule],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
