import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NppesService } from './nppes.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, NppesService],
  exports: [OnboardingService, NppesService],
})
export class OnboardingModule {}
