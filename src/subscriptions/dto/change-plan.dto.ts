import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePlanDto {
  @ApiProperty({ example: 'PRO_MONTHLY' })
  @IsString()
  planCode!: string;
}
