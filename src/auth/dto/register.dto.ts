import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Blessing' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Moyo' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: 'owner@builderpro.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'Builder Pro Demo',
    description: 'Company name used to auto-generate tenant slug when companySlug is omitted',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    example: 'builder-pro-demo',
    description: 'Optional existing tenant slug. If omitted, companyName is used to generate slug.',
  })
  @IsOptional()
  @IsString()
  companySlug?: string;

  @ApiPropertyOptional({ example: '+263771234567' })
  @IsOptional()
  @ValidateIf((value) => value.phone !== null)
  @IsString()
  phone?: string;
}
