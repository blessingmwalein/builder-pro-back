import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PoItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost: number;
}

export class CreatePoDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  supplierId: string;

  @ApiPropertyOptional({ description: 'Purchase Request ID (optional — PO can be created standalone)' })
  @IsOptional()
  @IsString()
  purchaseRequestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [PoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoItemDto)
  items: PoItemDto[];
}
