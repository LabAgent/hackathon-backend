import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
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

  verifyBackupCode(backupCodes: string[], code: string): number {
    return backupCodes.findIndex((c) => c === code);
  }

  async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  }

  async verifyBackupCodeHashed(
    hashedCodes: string[],
    code: string,
  ): Promise<number> {
    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await bcrypt.compare(code, hashedCodes[i]);
      if (match) return i;
    }
    return -1;
  }
}
