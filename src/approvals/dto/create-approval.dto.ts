import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApprovalDto {
  @ApiProperty({ description: 'Entity type: BUDGET | PROCUREMENT_PR | PROCUREMENT_PO | DOCUMENT | STAGE | CHANGE_REQUEST' })
  @IsString()
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiProperty({ type: [String], description: 'Ordered list of approver user IDs' })
  @IsArray()
  @IsString({ each: true })
  approverIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
