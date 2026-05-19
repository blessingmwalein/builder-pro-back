import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientUserDto {
  @ApiProperty({ description: 'ID of the system User to link' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canViewProgress?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canApproveMilestones?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canReviewInvoices?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canSubmitChanges?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canTrackPayments?: boolean;
}
