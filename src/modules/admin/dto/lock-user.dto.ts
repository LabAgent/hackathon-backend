import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class LockUserDto {
  @ApiProperty({
    description: 'Whether to lock (true) or unlock (false) the account',
  })
  @IsBoolean()
  locked: boolean;
}
