import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [UsersModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
