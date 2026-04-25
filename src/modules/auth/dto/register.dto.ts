import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password';
import { UserRole } from '../../../entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: 'researcher', enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
