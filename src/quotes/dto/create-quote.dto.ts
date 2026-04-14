import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class QuoteLineItemDto {
  @ApiProperty({ example: 'Labour' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 'Block walling team' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 24 })
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity!: number;

  @ApiProperty({ example: 15.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'hours' })
  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateQuoteDto {
  @ApiProperty({ example: 'cm9v0client0001abc' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ example: 'cm9v0pr0j0001abc' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ example: 'Quotation for house extension' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Final quote with standard VAT terms' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '50% upfront, 50% on completion' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiProperty({ example: '2026-04-02' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ example: '2026-04-16' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  taxRate?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  discountAmount?: number;

  @ApiProperty({
    type: [QuoteLineItemDto],
    example: [
      { category: 'Labour', description: 'Masons', quantity: 24, unitPrice: 15.5 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemDto)
  lineItems!: QuoteLineItemDto[];
}
