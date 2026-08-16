import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
    // No server-side login endpoint exists to specifically rate-limit
    // (auth goes straight from the browser to Cognito, see cognito.ts) — this
    // is baseline DoS/abuse protection for the authenticated API surface.
    // 100 req/min/IP is generous against real usage (Dashboard.tsx polls
    // every 15s while a note is processing) while still catching a scripted
    // client hammering an endpoint.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
