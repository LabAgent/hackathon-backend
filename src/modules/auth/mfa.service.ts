import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes, createHmac } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class MfaService {
  constructor(private configService: AppConfigService) {}

  generateSecret(email: string): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      email,
      this.configService.smtpConfig.fromName || 'App',
      secret,
    );
    return { secret, otpauthUrl };
  }

  async generateQrCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  verifyTotp(secret: string, token: string): boolean {
    return authenticator.verify({ token, secret });
  }

  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private hashBackupCode(code: string): string {
    return createHmac('sha256', this.configService.jwtSecret)
      .update(code)
      .digest('hex');
  }

  hashBackupCodes(codes: string[]): string[] {
    return codes.map((code) => this.hashBackupCode(code));
  }

  verifyBackupCodeHashed(hashedCodes: string[], code: string): number {
    const hash = this.hashBackupCode(code);
    return hashedCodes.findIndex((h) => h === hash);
  }
}
