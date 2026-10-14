import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { UserRole } from '../../infrastructure/database/entities/UserEntity.js';

@ApiTags('Auth & SSO')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sso/login')
  @ApiOperation({ summary: 'Вхід через університетський SSO (Google Workspace)' })
  async ssoLogin(
    @Body('email') email: string,
    @Body('full_name') fullName: string,
    @Body('role') role: UserRole,
  ) {
    const user = await this.authService.handleSsoLogin(email, fullName, role);
    return {
      message: 'Успішна автентифікація через університетський SSO',
      user,
      accessToken: `mock-jwt-token-for-${user.id}-${user.role}`,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Список користувачів системи' })
  async getUsers() {
    return this.authService.getAllUsers();
  }
}
