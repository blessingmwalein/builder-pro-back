import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateParticipantsDto {
  @ApiProperty({ example: ['user-id-1', 'user-id-2'], description: 'List of user IDs to add or remove' })
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}
