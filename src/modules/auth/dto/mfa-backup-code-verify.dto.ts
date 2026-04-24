import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class MfaBackupCodeVerifyDto {
  @ApiProperty({ description: 'Temporary token received from login step 1' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({ description: 'Backup code' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  backupCode: string;
}
