import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AllocateEquipmentDto {
  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty({ example: '2026-05-17' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-06-17' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
