import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(companyId: string, uploaderId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        companyId,
        projectId: dto.projectId,
        uploaderId,
        type: (dto as any).type ?? DocumentType.OTHER,
        folder: (dto as any).folder,
        fileKey: dto.fileKey,
        fileName: dto.fileName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        gpsLat: (dto as any).gpsLat,
        gpsLng: (dto as any).gpsLng,
        metadata: (dto as any).metadata,
      },
    });
  }

  async list(
    companyId: string,
    query: PaginationQueryDto & {
      projectId?: string;
      type?: DocumentType;
      folder?: string;
    },
  ) {
    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const where = {
      companyId,
      deletedAt: null,
      projectId: query.projectId,
      type: query.type,
      folder: query.folder,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, meta: { page: query.page, limit, total } };
  }

  async findOne(companyId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async getDownloadUrl(companyId: string, id: string): Promise<{ url: string; fileKey: string; fileName: string }> {
    const doc = await this.findOne(companyId, id);

    const fileKey = doc.fileKey;
    const baseUrl = process.env.FILE_STORAGE_BASE_URL ?? 'http://localhost:3000/files';

    return {
      url: `${baseUrl}/${fileKey}`,
      fileKey,
      fileName: doc.fileName,
    };
  }

  async remove(companyId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!doc) throw new NotFoundException('Document not found');

    await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
