import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { UpdateClientUserPermissionsDto } from './dto/update-client-user-permissions.dto';

@Injectable()
export class ClientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async createPortalUser(companyId: string, clientId: string, dto: CreateClientUserDto) {
    const client = await (this.prisma as any).client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const existing = await (this.prisma as any).clientUser.findFirst({
      where: { companyId, clientId, userId: dto.userId },
    });
    if (existing) throw new ConflictException('User already linked to this client');

    return (this.prisma as any).clientUser.create({
      data: {
        companyId,
        clientId,
        userId: dto.userId,
        canViewProgress: dto.canViewProgress ?? true,
        canApproveMilestones: dto.canApproveMilestones ?? false,
        canReviewInvoices: dto.canReviewInvoices ?? false,
        canSubmitChanges: dto.canSubmitChanges ?? false,
        canTrackPayments: dto.canTrackPayments ?? false,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async listPortalUsers(companyId: string, clientId: string) {
    const client = await (this.prisma as any).client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    return (this.prisma as any).clientUser.findMany({
      where: { companyId, clientId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removePortalUser(companyId: string, clientId: string, userId: string) {
    const link = await (this.prisma as any).clientUser.findFirst({
      where: { companyId, clientId, userId },
    });
    if (!link) throw new NotFoundException('Portal user link not found');

    await (this.prisma as any).clientUser.delete({ where: { id: link.id } });
    return { success: true };
  }

  async updatePortalPermissions(
    companyId: string,
    clientId: string,
    userId: string,
    dto: UpdateClientUserPermissionsDto,
  ) {
    const link = await (this.prisma as any).clientUser.findFirst({
      where: { companyId, clientId, userId },
    });
    if (!link) throw new NotFoundException('Portal user link not found');

    return (this.prisma as any).clientUser.update({
      where: { id: link.id },
      data: {
        ...(dto.canViewProgress !== undefined && { canViewProgress: dto.canViewProgress }),
        ...(dto.canApproveMilestones !== undefined && { canApproveMilestones: dto.canApproveMilestones }),
        ...(dto.canReviewInvoices !== undefined && { canReviewInvoices: dto.canReviewInvoices }),
        ...(dto.canSubmitChanges !== undefined && { canSubmitChanges: dto.canSubmitChanges }),
        ...(dto.canTrackPayments !== undefined && { canTrackPayments: dto.canTrackPayments }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getClientAccessibleProjects(companyId: string, userId: string) {
    const links = await (this.prisma as any).clientUser.findMany({
      where: { userId, companyId, isActive: true },
      select: { clientId: true, canViewProgress: true },
    });

    const clientIds = links.map((l: any) => l.clientId);
    if (clientIds.length === 0) return [];

    return this.prisma.project.findMany({
      where: { companyId, clientId: { in: clientIds }, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClientProjectView(companyId: string, userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { clientId: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const link = await (this.prisma as any).clientUser.findFirst({
      where: { companyId, clientId: project.clientId, userId, isActive: true },
    });
    if (!link) throw new NotFoundException('Access denied');

    const result: any = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    if (link.canViewProgress) {
      result.stages = await (this.prisma as any).projectStage.findMany({
        where: { companyId, projectId },
        orderBy: [{ workflowCode: 'asc' }, { stageOrder: 'asc' }],
      });
    }

    return result;
  }
}
