import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectChangeRequestDto {
  @ApiProperty()
  @IsString()
  rejectionNotes: string;
}
