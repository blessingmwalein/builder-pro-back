import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBudgetCategoryDto {
  @ApiProperty({ example: 'Labour' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'LABOUR' })
  @IsString()
  code: string;
}
