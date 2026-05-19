import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OnboardingSetupDto {
  @ApiProperty({ type: [String], example: ['RESIDENTIAL', 'COMMERCIAL'] })
  @IsArray()
  @IsString({ each: true })
  selectedSectors: string[];

  @ApiProperty({ type: [String], example: ['HOUSE_CONSTRUCTION', 'RENOVATION'] })
  @IsArray()
  @IsString({ each: true })
  selectedProjectTypes: string[];

  @ApiProperty({ type: [String], example: ['CLIENT', 'PROJECT_MANAGER', 'FOREMAN'] })
  @IsArray()
  @IsString({ each: true })
  selectedStakeholders: string[];

  @ApiProperty({ type: [String], example: ['PROJECT_INITIATION', 'EXECUTION', 'HANDOVER'] })
  @IsArray()
  @IsString({ each: true })
  selectedWorkflows: string[];
}
