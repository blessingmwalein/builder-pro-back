import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null, isActive: true },
      include: {
        settings: true,
        individualProfile: true,
        sectors: { orderBy: { code: 'asc' } },
        projectTypes: { orderBy: { code: 'asc' } },
        stakeholders: {
          include: { role: { select: { id: true, name: true } } },
          orderBy: { type: 'asc' },
        },
        workflows: { orderBy: { code: 'asc' } },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    await this.getById(companyId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          name: dto.name,
          countryCode: dto.countryCode,
          defaultCurrency: dto.defaultCurrency,
          timezone: dto.timezone,
          legalName: dto.legalName,
          registrationNumber: dto.registrationNumber,
          taxNumber: dto.taxNumber,
          website: dto.website,
          companySize: dto.companySize,
          yearsOperating: dto.yearsOperating,
          description: dto.description,
          businessPhone: dto.businessPhone,
          businessEmail: dto.businessEmail,
          city: dto.city,
        },
      });

      if (dto.settings) {
        await (tx as any).companySettings.upsert({
          where: { companyId },
          create: { companyId, ...dto.settings },
          update: dto.settings,
        });
      }

      if (dto.individualProfile) {
        await (tx as any).individualBusinessProfile.upsert({
          where: { companyId },
          create: { companyId, businessName: dto.individualProfile.businessName ?? '', ...dto.individualProfile },
          update: dto.individualProfile,
        });
      }

      return tx.company.findFirst({
        where: { id: companyId },
        include: {
          settings: true,
          individualProfile: true,
          sectors: { orderBy: { code: 'asc' } },
          projectTypes: { orderBy: { code: 'asc' } },
          stakeholders: {
            include: { role: { select: { id: true, name: true } } },
            orderBy: { type: 'asc' },
          },
          workflows: { orderBy: { code: 'asc' } },
        },
      });
    });
  }

  async updateLogo(companyId: string, logoUrl: string, logoKey: string) {
    await this.getById(companyId);
    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl, logoKey },
    });
    return { logoUrl };
  }

  async findWorkflowStage(companyId: string, code: string) {
    return this.prisma.workflowTemplate.findFirst({ where: { companyId, code } });
  }

  async addWorkflowStage(companyId: string, code: string, name: string, description?: string) {
    return this.prisma.workflowTemplate.create({
      data: {
        companyId,
        code,
        name,
        description: description ?? '',
        stages: [],
        isEnabled: true,
      },
    });
  }
}
