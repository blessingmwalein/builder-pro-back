import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogMaterialUsageDto {
  @ApiProperty({ example: 'cm9v0pr0j0001abc' })
  @IsString()
  projectId!: string;

  @ApiProperty({ example: 'cm9v0mat0001abc' })
  @IsString()
  materialId!: string;

  @ApiProperty({ example: 120.75 })
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity!: number;

  @ApiProperty({ example: 11.2 })
  @IsNumber({ maxDecimalPlaces: 2 })
  unitCost!: number;

  @ApiPropertyOptional({ example: 'cm9v0supplier0001' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ example: 'Used for slab pour at block A' })
  @IsOptional()
  @IsString()
  notes?: string;
}
