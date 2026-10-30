import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';
import { IngestAuditDto, AuditQueryDto } from './audit.dto.js';
import { InternalTokenGuard, Public, Roles, UserRole } from './audit.guard.js';

@ApiTags('Audit & Security')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Public()
  @Post('events')
  @UseGuards(InternalTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({ name: 'x-audit-secret', required: true, description: 'Internal ingest token' })
  @ApiOperation({ summary: 'Internal ingest endpoint used by the API Gateway' })
  ingest(@Body() dto: IngestAuditDto) {
    return this.audit.ingest(dto);
  }

  @Get('logs')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search audit logs (admin only)' })
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aggregated audit statistics (admin only)' })
  stats() {
    return this.audit.stats();
  }
}
