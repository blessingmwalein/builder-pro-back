import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddProjectMemberDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional({ example: 'Site Supervisor' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: ['tasks.*', 'documents.view'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
