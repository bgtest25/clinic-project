import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClinicsModule } from './clinics/clinics.module';
import { EncountersModule } from './encounters/encounters.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotesModule } from './notes/notes.module';
import { PatientDataRequestsModule } from './patient-data-requests/patient-data-requests.module';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecordingsModule } from './recordings/recordings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ClinicsModule,
    PatientsModule,
    PatientDataRequestsModule,
    EncountersModule,
    RecordingsModule,
    UsersModule,
    NotesModule,
    MetricsModule,
  ],
})
export class AppModule {}
