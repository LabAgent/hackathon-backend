import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private mailerService: MailerService,
    private configService: AppConfigService,
  ) {}

  private redactEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.charAt(0)}***@${domain}`;
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify your email address',
        template: 'verify-email',
        context: {
          code,
          appName: this.configService.smtpConfig.fromName,
        },
      });
      this.logger.log(`Verification email sent to ${this.redactEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${this.redactEmail(email)}`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome!',
        template: 'welcome',
        context: {
          fullName,
          appName: this.configService.smtpConfig.fromName,
          loginUrl: `${this.configService.url}/auth/login`,
        },
      });
      this.logger.log(`Welcome email sent to ${this.redactEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${this.redactEmail(email)}`,
        error,
      );
    }
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset your password',
        template: 'reset-password',
        context: {
          code,
          appName: this.configService.smtpConfig.fromName,
        },
      });
      this.logger.log(
        `Password reset email sent to ${this.redactEmail(email)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${this.redactEmail(email)}`,
        error,
      );
      throw error;
    }
  }

  async sendMfaEnabledEmail(email: string, fullName: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Two-Factor Authentication Enabled',
        template: 'mfa-enabled',
        context: {
          fullName,
          appName: this.configService.smtpConfig.fromName,
        },
      });
      this.logger.log(`MFA enabled email sent to ${this.redactEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send MFA enabled email to ${this.redactEmail(email)}`,
        error,
      );
    }
  }

  async sendAccountLockedEmail(email: string, fullName: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Account Locked',
        template: 'account-locked',
        context: {
          fullName,
          appName: this.configService.smtpConfig.fromName,
          supportUrl: `${this.configService.url}`,
        },
      });
      this.logger.log(
        `Account locked email sent to ${this.redactEmail(email)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send account locked email to ${this.redactEmail(email)}`,
        error,
      );
    }
  }
}
