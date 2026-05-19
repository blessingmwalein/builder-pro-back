import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestType } from '@prisma/client';

class ChangeRequestItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  unitCost?: number;
}

export class CreateChangeRequestDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: ChangeRequestType })
  @IsOptional()
  @IsEnum(ChangeRequestType)
  type?: ChangeRequestType;

  @ApiPropertyOptional({ type: [ChangeRequestItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeRequestItemDto)
  items?: ChangeRequestItemDto[];
}
