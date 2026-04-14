import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class BudgetLineDto {
  @IsString()
  categoryId: string;

  @IsNumber()
  plannedAmount: number;

  @IsOptional()
  @IsNumber()
  thresholdPct?: number;
}

export class SetProjectBudgetDto {
  @ApiProperty({ type: [BudgetLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineDto)
  lines: BudgetLineDto[];
}
