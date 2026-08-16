import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// The ALB target group hits this every ~15-30s to decide whether to route
// traffic here at all — throttling it would eventually make the ALB mark a
// perfectly healthy task as unhealthy.
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
