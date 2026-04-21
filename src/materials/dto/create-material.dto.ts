import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
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

  @ApiPropertyOptional({
    example: 'cm9v0cat0001',
    description: 'MaterialCategory.id — prefer over the legacy freeform `category` string.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Cement' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 10, description: 'Trigger a low-stock alert when stock drops to or below this.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  reorderAt?: number;

  @ApiPropertyOptional({ example: 'High-strength cement, 32.5N grade, 50kg bags.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 25, description: 'Opening stock balance for this material.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockOnHand?: number;
}
