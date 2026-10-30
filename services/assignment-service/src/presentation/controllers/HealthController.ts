import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../auth/auth.guard.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startedAt = new Date();

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe for the Assignment Service' })
  check() {
    return {
      status: 'UP',
      service: 'assignment-service',
      version: '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
