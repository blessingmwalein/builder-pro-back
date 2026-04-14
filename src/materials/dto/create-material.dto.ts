import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaterialDto {
  @ApiProperty({ example: 'Cement 32.5N' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'CEM-32-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ example: 'bag' })
  @IsString()
  unit!: string;

  @ApiProperty({ example: 12.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  unitCost!: number;

  @ApiPropertyOptional({ example: 'cm9v0supplier0001' })
  @IsOptional()
  @IsString()
  supplierId?: string;
}
