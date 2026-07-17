import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClinicsModule } from './clinics/clinics.module';
import { EncountersModule } from './encounters/encounters.module';
import { HealthModule } from './health/health.module';
import { PatientsModule } from './patients/patients.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecordingsModule } from './recordings/recordings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ClinicsModule,
    PatientsModule,
    EncountersModule,
    RecordingsModule,
  ],
})
export class AppModule {}
