import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
