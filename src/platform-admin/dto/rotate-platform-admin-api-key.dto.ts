import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RotatePlatformAdminApiKeyDto {
  @ApiProperty({
    required: false,
    example: 'Quarterly key rotation',
    description: 'Optional reason for audit context',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
