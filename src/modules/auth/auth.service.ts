import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User, UserRole } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { AppConfigService } from '../../config/app-config.service';
import { EmailService } from '../email/email.service';
import { MfaService } from './mfa.service';
import {
  RegisterDto,
  LoginDto,
  MfaVerifyDto,
  MfaEnableDto,
  MfaDisableDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  MfaBackupCodeVerifyDto,
  VerifyEmailDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationRepository: Repository<EmailVerificationToken>,
    private jwtService: JwtService,
    private configService: AppConfigService,
    private emailService: EmailService,
    private mfaService: MfaService,
  ) {}

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role || UserRole.USER,
    });
    await this.userRepository.save(user);

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tokenEntity = this.emailVerificationRepository.create({
      code,
      userId: user.id,
      expiresAt,
    });
    await this.emailVerificationRepository.save(tokenEntity);

    await this.emailService.sendVerificationEmail(user.email, code);

    return {
      message: 'Registration successful. Please check your email for the verification code.',
      userId: user.id,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const verificationToken = await this.emailVerificationRepository.findOne({
      where: { code: dto.code },
      relations: ['user'],
    });
    if (!verificationToken) {
      throw new BadRequestException('Invalid verification code');
    }
    if (verificationToken.user.email !== dto.email) {
      throw new BadRequestException('Invalid verification code');
    }
    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired');
    }
    if (verificationToken.user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.userRepository.update(verificationToken.userId, {
      isVerified: true,
    });
    await this.emailVerificationRepository.delete(verificationToken.id);

    await this.emailService.sendWelcomeEmail(
      verificationToken.user.email,
      verificationToken.user.fullName,
    );

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new BadRequestException('No account found with this email');
    }
    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.emailVerificationRepository.delete({ userId: user.id });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.emailVerificationRepository.save(
      this.emailVerificationRepository.create({
        code,
        userId: user.id,
        expiresAt,
      }),
    );

    await this.emailService.sendVerificationEmail(user.email, code);

    return { message: 'Verification code resent successfully.' };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new HttpException(
        `Account locked. Try again in ${remainingMinutes} minutes`,
        HttpStatus.LOCKED,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account deactivated. Contact support.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const failedAttempts = user.failedAttempts + 1;
      if (failedAttempts >= this.configService.maxFailedAttempts) {
        const lockedUntil = new Date(
          Date.now() + this.configService.lockTimeMinutes * 60 * 1000,
        );
        await this.userRepository.update(user.id, {
          failedAttempts: 0,
          lockedUntil,
        });
        await this.emailService.sendAccountLockedEmail(user.email, user.fullName);
        throw new HttpException(
          'Account locked due to too many failed attempts',
          HttpStatus.LOCKED,
        );
      }
      await this.userRepository.update(user.id, {
        failedAttempts,
      });
      throw new UnauthorizedException(
        `Invalid credentials. ${this.configService.maxFailedAttempts - failedAttempts} attempts remaining`,
      );
    }

    await this.userRepository.update(user.id, {
      failedAttempts: 0,
      lockedUntil: null as any,
    });

    if (user.mfaEnabled) {
      const tempToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          mfaPending: true,
        },
        {
          secret: this.configService.jwtSecret,
          expiresIn: this.configService.jwtMfaExpiration as any,
        },
      );
      return {
        mfaRequired: true,
        tempToken,
        message: 'MFA verification required',
      };
    }

    await this.userRepository.update(user.id, { lastLogin: new Date() });
    return this.generateTokens(user);
  }

  async verifyMfa(dto: MfaVerifyDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.configService.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (!payload.mfaPending) {
      throw new BadRequestException('Invalid token for MFA verification');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!this.mfaService.verifyTotp(user.mfaSecret!, dto.totpCode)) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.userRepository.update(user.id, {
      lastLogin: new Date(),
      failedAttempts: 0,
    });

    return this.generateTokens(user);
  }

  async verifyMfaBackupCode(dto: MfaBackupCodeVerifyDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.configService.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (!payload.mfaPending) {
      throw new BadRequestException('Invalid token for MFA verification');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.mfaBackupCodes) {
      throw new UnauthorizedException('Invalid backup code');
    }

    const codeIndex = this.mfaService.verifyBackupCode(
      user.mfaBackupCodes,
      dto.backupCode,
    );
    if (codeIndex === -1) {
      throw new UnauthorizedException('Invalid backup code');
    }

    const updatedBackupCodes = [...user.mfaBackupCodes];
    updatedBackupCodes.splice(codeIndex, 1);
    await this.userRepository.update(user.id, {
      mfaBackupCodes: updatedBackupCodes,
      lastLogin: new Date(),
      failedAttempts: 0,
    });

    return this.generateTokens(user);
  }

  async setupMfa(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const { secret, otpauthUrl } = this.mfaService.generateSecret(user.email);
    const qrCode = await this.mfaService.generateQrCode(otpauthUrl);

    await this.userRepository.update(userId, { mfaSecret: secret });

    return {
      secret,
      qrCode,
      manualEntry: otpauthUrl,
      message: 'Scan the QR code with your authenticator app, then verify with the enable endpoint',
    };
  }

  async enableMfa(userId: string, dto: MfaEnableDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException('Please set up MFA first using the setup endpoint');
    }

    if (!this.mfaService.verifyTotp(user.mfaSecret, dto.totpCode)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const backupCodes = this.mfaService.generateBackupCodes();
    await this.userRepository.update(userId, {
      mfaEnabled: true,
      mfaBackupCodes: backupCodes,
    });

    await this.emailService.sendMfaEnabledEmail(user.email, user.fullName);

    return {
      message: 'MFA enabled successfully',
      backupCodes,
    };
  }

  async disableMfa(userId: string, dto: MfaDisableDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: null as any,
      mfaBackupCodes: null as any,
    });

    return { message: 'MFA disabled successfully' };
  }

  async regenerateBackupCodes(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const backupCodes = this.mfaService.generateBackupCodes();
    await this.userRepository.update(userId, { mfaBackupCodes: backupCodes });

    return {
      message: 'Backup codes regenerated successfully',
      backupCodes,
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    const refreshTokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: dto.refreshToken },
      relations: ['user'],
    });

    if (!refreshTokenEntity) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (refreshTokenEntity.isRevoked) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (refreshTokenEntity.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }
    if (!refreshTokenEntity.user.isActive) {
      throw new ForbiddenException('Account deactivated');
    }

    await this.refreshTokenRepository.update(refreshTokenEntity.id, {
      isRevoked: true,
    });

    return this.generateTokens(refreshTokenEntity.user);
  }

  async logout(refreshToken: string) {
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
    });
    if (tokenEntity) {
      await this.refreshTokenRepository.update(tokenEntity.id, {
        isRevoked: true,
      });
    }
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      return { message: 'If an account with this email exists, a reset code has been sent.' };
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.passwordResetRepository.save(
      this.passwordResetRepository.create({
        code,
        userId: user.id,
        expiresAt,
      }),
    );

    await this.emailService.sendPasswordResetEmail(user.email, code);

    return { message: 'If an account with this email exists, a reset code has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.passwordResetRepository.findOne({
      where: { code: dto.code },
      relations: ['user'],
    });
    if (!resetToken) {
      throw new BadRequestException('Invalid reset code');
    }
    if (resetToken.user.email !== dto.email) {
      throw new BadRequestException('Invalid reset code');
    }
    if (resetToken.used) {
      throw new BadRequestException('Reset code has already been used');
    }
    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset code has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.userRepository.update(resetToken.userId, { passwordHash });
    await this.passwordResetRepository.update(resetToken.id, { used: true });

    await this.refreshTokenRepository.delete({ userId: resetToken.userId });

    return { message: 'Password reset successfully' };
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.jwtExpiration as any,
    });

    const refreshToken = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.parseDuration(this.configService.jwtRefreshExpiration),
    );

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        token: refreshToken,
        userId: user.id,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        image: user.image,
      },
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}