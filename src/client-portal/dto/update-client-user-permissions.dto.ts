import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientUserPermissionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canViewProgress?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canApproveMilestones?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canReviewInvoices?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canSubmitChanges?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canTrackPayments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
