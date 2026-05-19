import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveChangeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  approvedCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  approvedDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
