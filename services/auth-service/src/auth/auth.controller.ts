import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Public, Roles, AuthUser } from './auth.guard.js';
import { UserRole } from '../users/roles.js';

@ApiTags('Auth & Identity')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вхід за логіном/email та паролем. Повертає JWT.' })
  login(@Body() dto: { login?: string; email?: string; password: string }) {
    return this.authService.login(dto?.login || dto?.email || '', dto?.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Профіль поточного користувача (з JWT)' })
  async me(@Req() req: { user: AuthUser }) {
    return this.authService.findById(req.user.userId);
  }

  @Get('directory')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Довідник користувачів для повідомлень (id, ПІБ, роль)' })
  directory() {
    return this.authService.directory();
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Список користувачів (лише адміністратор)' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Post('users')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Створити користувача (лише адміністратор)' })
  createUser(
    @Body()
    dto: {
      email: string;
      password: string;
      fullName: string;
      role?: UserRole;
      username?: string;
      department?: string;
    },
  ) {
    return this.authService.createUser(dto);
  }
}
