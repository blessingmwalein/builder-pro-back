import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionsDto {
  @ApiProperty({ type: [String], example: ['tasks.*', 'materials.log'] })
  @IsArray()
  @IsString({ each: true })
  permissionKeys: string[];
}
