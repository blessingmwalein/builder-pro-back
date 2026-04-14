import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkNotificationReadDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isRead!: boolean;
}
