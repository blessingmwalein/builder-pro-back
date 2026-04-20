import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
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
    example: 'SMALL_BUSINESS',
    description: 'Platform plan code. Defaults to SMALL_BUSINESS (14-day free trial).',
  })
  @IsOptional()
  @IsString()
  planCode?: string;
}
