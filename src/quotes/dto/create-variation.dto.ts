import { IsArray, IsEnum, IsOptional, IsString, IsNumber, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariationType } from '@prisma/client';
import { Type } from 'class-transformer';

class VariationLineItemDto {
  @IsString()
  category: string;

  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  unitPrice: number;
}

export class CreateVariationDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: VariationType })
  @IsOptional()
  @IsEnum(VariationType)
  type?: VariationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quoteId?: string;

  @ApiProperty({ type: [VariationLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationLineItemDto)
  lineItems: VariationLineItemDto[];
}
