import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ example: 'project-cost-summary' })
  @IsString()
  reportType!: string;

  @ApiPropertyOptional({
    example: { projectId: 'cm9v0pr0j0001abc', from: '2026-04-01', to: '2026-04-30' },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
