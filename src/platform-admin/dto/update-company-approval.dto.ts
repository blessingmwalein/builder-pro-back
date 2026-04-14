import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCompanyApprovalDto {
  @ApiProperty({ example: true, description: 'true to approve/activate company' })
  @IsBoolean()
  isActive!: boolean;
}
