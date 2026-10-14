import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service.js';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Отримати журнал аудиту безпеки (тільки для адміністратора)' })
  async getLogs() {
    return this.auditService.getAllLogs();
  }
}
