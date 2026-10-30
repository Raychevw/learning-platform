import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../audit/audit.guard.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startedAt = new Date();

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe for the Audit Service' })
  check() {
    return {
      status: 'UP',
      service: 'audit-service',
      version: '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
