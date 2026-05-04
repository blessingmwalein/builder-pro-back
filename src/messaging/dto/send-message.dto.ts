import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MessageAttachmentDto {
  @ApiProperty({ example: 'messages/uuid-file.pdf' })
  @IsString()
  fileKey!: string;

  @ApiProperty({ example: 'drawing.pdf' })
  @IsString()
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  contentType!: string;

  @ApiProperty({ example: 102400 })
  sizeBytes!: number;
}

export class SendMessageDto {
  @ApiProperty({ example: 'cm9v0conv0001abc' })
  @IsString()
  conversationId!: string;

  @ApiProperty({ example: 'Please confirm slab pour is ready for tomorrow.' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiProperty({ type: [MessageAttachmentDto], required: false })
  @IsArray()
  @IsOptional()
  attachments?: MessageAttachmentDto[];
}
