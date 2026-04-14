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

class InvoiceLineItemDto {
  @ApiProperty({ example: 'Concrete works milestone 1' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 1 })
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity!: number;

  @ApiProperty({ example: 3500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'm3' })
  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: 'cm9v0client0001abc' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ example: 'cm9v0pr0j0001abc' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'cm9v0quote0001abc' })
  @IsOptional()
  @IsString()
  quoteId?: string;

  @ApiProperty({ example: '2026-04-02' })
  @IsDateString()
  issueDate!: string;

  @ApiProperty({ example: '2026-04-12' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ example: 'Invoice for foundation phase 1' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Net 14 days' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ example: 10, description: 'Retention percentage 0-100' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  retentionPct?: number;

  @ApiProperty({
    type: [InvoiceLineItemDto],
    example: [{ description: 'Concrete works milestone 1', quantity: 1, unitPrice: 3500 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];
}
