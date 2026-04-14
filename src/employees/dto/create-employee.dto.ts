import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiPropertyOptional({ example: 'cm9v0usr0001abc' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: 'EMP-0004' })
  @IsString()
  employeeCode!: string;

  @ApiProperty({ example: 'Foreman' })
  @IsString()
  jobTitle!: string;

  @ApiProperty({ example: 'Full-time' })
  @IsString()
  employmentType!: string;

  @ApiProperty({ example: 12.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  hourlyRate!: number;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
