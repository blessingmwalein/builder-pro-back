import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestType } from '@prisma/client';

export class UpdateChangeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ChangeRequestType })
  @IsOptional()
  @IsEnum(ChangeRequestType)
  type?: ChangeRequestType;
}
