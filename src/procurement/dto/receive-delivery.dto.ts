import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliveryItemDto {
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
  quantityOrdered: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantityReceived: number;
}

export class ReceiveDeliveryDto {
  @ApiProperty({ example: '2026-05-17' })
  @IsDateString()
  deliveryDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [DeliveryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemDto)
  items: DeliveryItemDto[];
}
