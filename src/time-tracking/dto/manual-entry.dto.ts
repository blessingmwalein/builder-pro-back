import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualTimeEntryDto {
  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ example: '2026-04-03T08:00:00.000Z' })
  @IsISO8601()
  clockInAt: string;

  @ApiProperty({ example: '2026-04-03T17:00:00.000Z' })
  @IsISO8601()
  clockOutAt: string;

  @ApiPropertyOptional({ example: 30, description: 'Break duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
