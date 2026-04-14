import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TimeEntryStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveTimeEntryDto {
  @ApiProperty({ enum: TimeEntryStatus, example: TimeEntryStatus.APPROVED })
  @IsEnum(TimeEntryStatus)
  status!: TimeEntryStatus;

  @ApiPropertyOptional({ example: 'Approved after site supervisor review' })
  @IsOptional()
  @IsString()
  approvalComment?: string;
}
