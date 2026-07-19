import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import { UsersModule } from '../users/users.module';
import { PatientDataRequestsController } from './patient-data-requests.controller';
import { PatientDataRequestsService } from './patient-data-requests.service';

@Module({
  imports: [UsersModule, PatientsModule],
  controllers: [PatientDataRequestsController],
  providers: [PatientDataRequestsService],
})
export class PatientDataRequestsModule {}
