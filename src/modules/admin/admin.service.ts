import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { AdminUpdateUserDto, ListUsersQueryDto, LockUserDto } from './dto';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class AdminService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: AppConfigService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { users, total } = await this.usersService.findAll(
      page,
      limit,
      query.search,
      query.role,
    );
    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string) {
    return this.usersService
      .findById(id)
      .then((user) => this.usersService.sanitizeUser(user));
  }

  async updateUser(id: string, dto: AdminUpdateUserDto) {
    await this.usersService.findById(id);
    return this.usersService.adminUpdateUser(id, dto);
  }

  async lockUser(id: string, dto: LockUserDto) {
    await this.usersService.findById(id);
    if (dto.locked) {
      return this.usersService.lockUser(id, this.configService.lockTimeMinutes);
    }
    return this.usersService.unlockUser(id);
  }

  async deactivateUser(id: string) {
    await this.usersService.findById(id);
    return this.usersService.deactivateUser(id);
  }
}
