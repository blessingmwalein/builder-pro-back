import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({ example: 'VAT' })
  @IsOptional()
  @IsString()
  taxName?: string;

  @ApiPropertyOptional({ example: 'INV' })
  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  invoiceNextNumber?: number;

  @ApiPropertyOptional({ example: 'QUO' })
  @IsOptional()
  @IsString()
  quotePrefix?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quoteNextNumber?: number;

  @ApiPropertyOptional({ example: 'PO' })
  @IsOptional()
  @IsString()
  purchaseOrderPrefix?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  purchaseOrderNext?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export class UpdateIndividualProfileDto {
  @ApiPropertyOptional({ example: 'John Builds' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ example: 'Specialist in residential renovations' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'RESIDENTIAL' })
  @IsOptional()
  @IsString()
  primarySector?: string;

  @ApiPropertyOptional({ example: '1-3' })
  @IsOptional()
  @IsString()
  businessSize?: string;

  @ApiPropertyOptional({ example: ['Harare', 'Bulawayo'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceAreas?: string[];

  @ApiPropertyOptional({ example: '+263771234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'john@builds.co.zw' })
  @IsOptional()
  @IsString()
  businessEmail?: string;

  @ApiPropertyOptional({ example: 'REG123456' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'TAX123456' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'ZW' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Harare' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  yearsOperating?: number;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'ownit2buildit Zimbabwe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'ZW' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'Africa/Harare' })
  @IsOptional()
  @IsString()
  timezone?: string;

  // Extended profile fields
  @ApiPropertyOptional({ example: 'ownit2buildit Zimbabwe (Pvt) Ltd' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: 'REG/2019/1234' })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'TAX-2019-1234' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'https://builderpro.co.zw' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'SMALL' })
  @IsOptional()
  @IsString()
  companySize?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  yearsOperating?: number;

  @ApiPropertyOptional({ example: 'Leading construction firm in Zimbabwe.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '+263771234567' })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiPropertyOptional({ example: 'info@builderpro.co.zw' })
  @IsOptional()
  @IsString()
  businessEmail?: string;

  @ApiPropertyOptional({ example: 'Harare' })
  @IsOptional()
  @IsString()
  city?: string;

  // Nested settings
  @ApiPropertyOptional({ type: UpdateCompanySettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCompanySettingsDto)
  settings?: UpdateCompanySettingsDto;

  // Individual profile (INDIVIDUAL account type only)
  @ApiPropertyOptional({ type: UpdateIndividualProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateIndividualProfileDto)
  individualProfile?: UpdateIndividualProfileDto;
}
