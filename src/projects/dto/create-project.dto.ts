import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ProjectStatus, ProjectType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiPropertyOptional({ example: 'PRJ-2026-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Harare Mall Fit-out' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Interior civil works and finishes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, example: ProjectStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectType, example: ProjectType.COMMERCIAL })
  @IsOptional()
  @IsEnum(ProjectType)
  projectType?: ProjectType;

  @ApiPropertyOptional({ example: '123 Main St, Harare' })
  @IsOptional()
  @IsString()
  siteAddress?: string;

  @ApiPropertyOptional({ description: 'User ID of the project manager' })
  @IsOptional()
  @IsString()
  projectManagerId?: string;

  @ApiPropertyOptional({ example: '2026-04-05' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-07-20' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: 120000.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999)
  baselineBudget!: number;

  @ApiPropertyOptional({ example: 'cm9v0cl1ent0001abc' })
  @IsOptional()
  @IsString()
  clientId?: string;
}
