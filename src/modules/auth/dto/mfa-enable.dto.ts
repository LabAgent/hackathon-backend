import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class MfaEnableDto {
  @ApiProperty({ description: 'TOTP code from authenticator app', example: '123456' })
  @IsString()
  @IsNotEmpty()
  totpCode: string;
}