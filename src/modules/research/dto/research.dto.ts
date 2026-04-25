import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, Min, MinLength, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Kelp Growth Analysis' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Study of kelp growth rates under varying light conditions' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  priority?: number;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['planned', 'ongoing', 'completed'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;
}

export class CreateExperimentLogDto {
  @ApiPropertyOptional({ example: 'Light exposure increased growth by 40%' })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @ApiPropertyOptional({ example: 'Controlled environment test' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProjectRequirementDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  projectId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  inventoryId: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  requiredQuantity: number;
}
