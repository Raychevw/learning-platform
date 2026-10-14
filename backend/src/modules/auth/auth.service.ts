import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../../infrastructure/database/entities/UserEntity.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * SSO (OAuth2 / OIDC) login simulation with corporate Google Workspace email
   */
  async handleSsoLogin(email: string, fullName: string, role: UserRole = UserRole.STUDENT, ssoId?: string): Promise<UserEntity> {
    let user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      user = this.userRepo.create({
        email,
        full_name: fullName,
        role,
        sso_id: ssoId || `sso-google-${Date.now()}`,
      });
      await this.userRepo.save(user);
    }
    return user;
  }

  async findUserById(id: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async getAllUsers(): Promise<UserEntity[]> {
    return this.userRepo.find();
  }
}
