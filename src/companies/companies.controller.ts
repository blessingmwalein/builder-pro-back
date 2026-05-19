import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { RequestTenant } from '../common/interfaces/request-context.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompaniesService } from './companies.service';

class CreateWorkflowStageDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

@ApiTags('Companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Permissions('settings.*')
  @Get('me')
  getMine(@Tenant() tenant: RequestTenant) {
    return this.companiesService.getById(tenant.companyId);
  }

  @Permissions('settings.*')
  @Patch('me')
  updateMine(@Tenant() tenant: RequestTenant, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(tenant.companyId, dto);
  }

  @Permissions('settings.*')
  @Post('me/workflow-stages')
  @ApiOperation({ summary: 'Add a custom workflow stage to this company' })
  async addWorkflowStage(
    @Tenant() tenant: RequestTenant,
    @Body() dto: CreateWorkflowStageDto,
  ) {
    const code = dto.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    const existing = await this.companiesService.findWorkflowStage(tenant.companyId, code);
    if (existing) throw new ConflictException('A stage with this name already exists');
    return this.companiesService.addWorkflowStage(tenant.companyId, code, dto.name, dto.description);
  }

  @Permissions('settings.*')
  @Post('me/logo')
  @ApiOperation({ summary: 'Upload company logo (image, max 2 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
    }),
  )
  async uploadLogo(
    @Tenant() tenant: RequestTenant,
    @UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const uploadsDir = join(process.cwd(), 'uploads', 'logos');

    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(join(uploadsDir, filename), file.buffer);

    const baseUrl = process.env.FILE_STORAGE_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const logoUrl = `${baseUrl}/uploads/logos/${filename}`;

    return this.companiesService.updateLogo(tenant.companyId, logoUrl, `logos/${filename}`);
  }
}
