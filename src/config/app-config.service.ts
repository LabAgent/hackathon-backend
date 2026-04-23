import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('app.port')!;
  }

  get url(): string {
    return this.configService.get<string>('app.url')!;
  }

  get maxFailedAttempts(): number {
    return this.configService.get<number>('app.maxFailedAttempts')!;
  }

  get lockTimeMinutes(): number {
    return this.configService.get<number>('app.lockTimeMinutes')!;
  }

  get jwtSecret(): string {
    return this.configService.get<string>('app.jwt.secret')!;
  }

  get jwtRefreshSecret(): string {
    return this.configService.get<string>('app.jwt.refreshSecret')!;
  }

  get jwtExpiration(): string {
    return this.configService.get<string>('app.jwt.expiration')!;
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get<string>('app.jwt.refreshExpiration')!;
  }

  get jwtMfaExpiration(): string {
    return this.configService.get<string>('app.jwt.mfaExpiration')!;
  }

  get dbConfig() {
    return this.configService.get('app.db')!;
  }

  get smtpConfig() {
    return this.configService.get('app.smtp')!;
  }

  get cloudinaryConfig() {
    return this.configService.get('app.cloudinary')!;
  }
}