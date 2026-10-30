import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Config')
@ApiBearerAuth()
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('ice')
  @ApiOperation({ summary: 'ICE servers (STUN/TURN) for WebRTC clients' })
  ice() {
    const servers: Array<Record<string, string>> = [
      { urls: this.configService.get<string>('STUN_URL', 'stun:stun.l.google.com:19302') },
    ];
    const turnUrl = this.configService.get<string>('TURN_URL', '');
    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: this.configService.get<string>('TURN_USERNAME', ''),
        credential: this.configService.get<string>('TURN_CREDENTIAL', ''),
      });
    }
    return { iceServers: servers };
  }
}
