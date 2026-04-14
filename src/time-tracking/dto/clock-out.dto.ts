import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClockOutDto {
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  breakMinutes?: number;

  @ApiPropertyOptional({ example: -17.825 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  gpsOutLat?: number;

  @ApiPropertyOptional({ example: 31.0532 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  gpsOutLng?: number;
}
