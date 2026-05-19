import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEquipmentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'] })
  @IsOptional()
  @IsIn(['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dailyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}
