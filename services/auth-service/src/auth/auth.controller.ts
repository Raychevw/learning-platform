import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
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

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Оновити власний профіль' })
  updateMe(
    @Req() req: { user: AuthUser },
    @Body()
    dto: { fullName?: string; email?: string; username?: string; department?: string; phone?: string },
  ) {
    return this.authService.updateProfile(req.user.userId, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Змінити власний пароль' })
  changePassword(
    @Req() req: { user: AuthUser },
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.userId, dto?.currentPassword, dto?.newPassword);
  }

  @Patch('users/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Редагувати користувача (лише адміністратор)' })
  updateUser(
    @Param('id') id: string,
    @Body()
    dto: {
      fullName?: string;
      email?: string;
      username?: string;
      department?: string;
      phone?: string;
      role?: UserRole;
      status?: 'ACTIVE' | 'EXPELLED' | 'ACADEMIC_LEAVE';
    },
  ) {
    return this.authService.updateUser(id, dto);
  }

  @Post('users/:id/password')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Скинути пароль користувача (лише адміністратор)' })
  resetPassword(@Param('id') id: string, @Body() dto: { password: string }) {
    return this.authService.resetPassword(id, dto?.password);
  }

  @Patch('users/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Змінити статус навчання (лише адміністратор)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: 'ACTIVE' | 'EXPELLED' | 'ACADEMIC_LEAVE' },
  ) {
    return this.authService.updateStatus(id, dto.status);
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
      phone?: string;
    },
  ) {
    return this.authService.createUser(dto);
  }
}
