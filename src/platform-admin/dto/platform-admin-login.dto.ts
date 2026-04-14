import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class PlatformAdminLoginDto {
  @ApiProperty({ example: 'platform-admin@builderpro.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'PlatformAdmin123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
