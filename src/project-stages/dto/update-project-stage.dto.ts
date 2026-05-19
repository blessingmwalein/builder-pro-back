import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StageStatus } from '@prisma/client';

export class UpdateProjectStageDto {
  @ApiPropertyOptional({ enum: StageStatus })
  @IsOptional()
  @IsEnum(StageStatus)
  status?: StageStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
