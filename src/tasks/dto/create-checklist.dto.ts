import { IsArray, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChecklistDto {
  @ApiProperty({ example: 'Safety Checklist' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ type: [String], example: ['Wear hard hat', 'Check scaffolding'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];
}
