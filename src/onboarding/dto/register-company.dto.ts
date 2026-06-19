import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class RegisterCompanyDto {
  @ApiProperty({ example: 'Acme Construction' })
  @IsString()
  companyName: string;

  @ApiPropertyOptional({ example: 'Construction' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ enum: AccountType, default: AccountType.COMPANY })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'ZW' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+263771234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'TEAM',
    description: 'Platform plan code. Defaults to TEAM (14-day free trial). Options: SOLE_TRADER, TEAM, ENTERPRISE.',
  })
  @IsOptional()
  @IsString()
  planCode?: string;

  // ── Company profile fields (Step 3B) ──────────────────────────
  @ApiPropertyOptional() @IsOptional() @IsString() legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companySize?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) yearsOperating?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;

  @ApiPropertyOptional({ example: 5, description: 'Number of user seats — determines per-person billing total.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  teamSize?: number;

  // ── Individual business profile fields (Step 3A) ──────────────
  @ApiPropertyOptional() @IsOptional() @IsString() businessName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() primarySector?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() businessSize?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) serviceAreas?: string[];
}
