import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Permissions('documents.*', 'documents.upload')
  @Post()
  @ApiOperation({ summary: 'Register an uploaded document (after upload to storage)' })
  create(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(tenant.companyId, user.userId, dto);
  }

  @Permissions('documents.*', 'documents.view')
  @Get()
  @ApiOperation({ summary: 'List documents with optional filters' })
  list(
    @Tenant() tenant: RequestTenant,
    @Query() query: PaginationQueryDto & { projectId?: string; type?: DocumentType; folder?: string },
  ) {
    return this.documentsService.list(tenant.companyId, query);
  }

  @Permissions('documents.*', 'documents.view')
  @Get(':id')
  @ApiOperation({ summary: 'Get document metadata' })
  findOne(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.documentsService.findOne(tenant.companyId, id);
  }

  @Permissions('documents.*', 'documents.view')
  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get a download URL for a document' })
  getDownloadUrl(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.documentsService.getDownloadUrl(tenant.companyId, id);
  }

  @Permissions('documents.*', 'documents.upload')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document (soft delete)' })
  remove(@Tenant() tenant: RequestTenant, @Param('id') id: string) {
    return this.documentsService.remove(tenant.companyId, id);
  }
}
