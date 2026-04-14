import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'cm9v0conv0001abc' })
  @IsString()
  conversationId!: string;

  @ApiProperty({ example: 'Please confirm slab pour is ready for tomorrow.' })
  @IsString()
  body!: string;
}
