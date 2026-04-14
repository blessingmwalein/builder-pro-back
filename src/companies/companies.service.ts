import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null, isActive: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    await this.getById(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.name,
        countryCode: dto.countryCode,
        defaultCurrency: dto.defaultCurrency,
        timezone: dto.timezone,
      },
    });
  }
}
