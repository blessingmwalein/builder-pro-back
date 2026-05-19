import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializeStagesDto {
  @ApiProperty({ example: ['PROJECT_INITIATION', 'PLANNING', 'EXECUTION', 'HANDOVER'] })
  @IsArray()
  @IsString({ each: true })
  workflowCodes: string[];
}
