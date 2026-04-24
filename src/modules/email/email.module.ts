import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { AppConfigService } from '../../config/app-config.service';
import { EmailService } from './email.service';
import * as path from 'path';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        transport: {
          host: configService.smtpConfig.host,
          port: configService.smtpConfig.port,
          secure: configService.smtpConfig.secure,
          auth: {
            user: configService.smtpConfig.user,
            pass: configService.smtpConfig.pass,
          },
        },
        defaults: {
          from: `"${configService.smtpConfig.fromName}" <${configService.smtpConfig.from}>`,
        },
        template: {
          dir: path.join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
