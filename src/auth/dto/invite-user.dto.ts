import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ example: 'worker@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: '+263771234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Role ID to assign to this user' })
  @IsOptional()
  @IsString()
  roleId?: string;

  // ── Optional employee record creation ─────────────────────────────────────

  @ApiPropertyOptional({ description: 'When true, also create an Employee record for this user' })
  @IsOptional()
  @IsBoolean()
  createAsEmployee?: boolean;

  @ApiPropertyOptional({ example: 'Foreman' })
  @IsOptional()
  @IsString()
  employeeJobTitle?: string;

  @ApiPropertyOptional({ example: 'FULL_TIME' })
  @IsOptional()
  @IsString()
  employeeType?: string;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  employeeHourlyRate?: number;

  @ApiPropertyOptional({ example: 'EMP-001' })
  @IsOptional()
  @IsString()
  employeeCode?: string;
}
