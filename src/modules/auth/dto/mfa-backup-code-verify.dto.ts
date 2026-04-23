import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class MfaBackupCodeVerifyDto {
  @ApiProperty({ description: 'Temporary token received from login step 1' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({ description: 'Backup code' })
  @IsString()
  @IsNotEmpty()
  backupCode: string;
}