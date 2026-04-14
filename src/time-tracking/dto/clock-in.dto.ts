import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClockInDto {
  @ApiProperty({ example: 'cm9v0pr0j0001abc' })
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ example: 'cm9v0task0001abc' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ example: -17.8249 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  gpsInLat?: number;

  @ApiPropertyOptional({ example: 31.053 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  gpsInLng?: number;
}
