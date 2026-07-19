import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';

@Module({
  imports: [UsersModule],
  controllers: [ClinicsController],
  providers: [ClinicsService],
})
export class ClinicsModule {}
