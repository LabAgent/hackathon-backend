import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({ description: 'Temporary token received from login step 1' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({ description: 'TOTP code from authenticator app', example: '123456' })
  @IsString()
  @IsNotEmpty()
  totpCode: string;
}