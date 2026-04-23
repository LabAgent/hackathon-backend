import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../../entities/user.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<Partial<User>> {
    const user = await this.findById(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) {
        throw new BadRequestException('Email already in use');
      }
    }

    await this.userRepository.update(id, {
      ...(dto.fullName && { fullName: dto.fullName }),
      ...(dto.email && { email: dto.email }),
    });

    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'passwordHash'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.update(id, { passwordHash: newPasswordHash });

    return { message: 'Password changed successfully' };
  }

  async uploadImage(id: string, file: Express.Multer.File): Promise<{ image: string }> {
    const user = await this.findById(id);

    if (user.image) {
      const publicId = this.cloudinaryService.getPublicIdFromUrl(user.image);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId);
      }
    }

    const imageUrl = await this.cloudinaryService.uploadImage(file, 'profiles');
    await this.userRepository.update(id, { image: imageUrl });

    return { image: imageUrl };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: string,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const query = this.userRepository.createQueryBuilder('user');

    if (search) {
      query.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    query.orderBy('user.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [users, total] = await query.getManyAndCount();

    return {
      users: users.map((u) => this.sanitizeUser(u)),
      total,
    };
  }

  async adminUpdateUser(
    id: string,
    dto: { role?: string; isActive?: boolean; fullName?: string },
  ): Promise<Partial<User>> {
    const updateData: Partial<User> = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.role !== undefined) updateData.role = dto.role as UserRole;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    await this.userRepository.update(id, updateData);
    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async lockUser(id: string, lockDurationMinutes: number): Promise<Partial<User>> {
    const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
    await this.userRepository.update(id, { lockedUntil });
    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async unlockUser(id: string): Promise<Partial<User>> {
    await this.userRepository.update(id, { lockedUntil: null as any, failedAttempts: 0 });
    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async deactivateUser(id: string): Promise<{ message: string }> {
    await this.userRepository.update(id, { isActive: false });
    return { message: 'User deactivated successfully' };
  }

  sanitizeUser(user: User): Partial<User> {
    const { passwordHash, mfaSecret, mfaBackupCodes, ...result } = user;
    return result;
  }
}