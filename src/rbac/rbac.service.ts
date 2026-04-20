import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';

const ALL_PERMISSION_KEYS = [
  'projects.*',
  'projects.view',
  'projects.create',
  'projects.delete',
  'tasks.*',
  'tasks.view',
  'tasks.create',
  'tasks.assign',
  'tasks.complete',
  'timesheets.*',
  'timesheets.view_own',
  'timesheets.view_all',
  'timesheets.approve',
  'materials.*',
  'materials.log',
  'materials.manage_inventory',
  'quotes.*',
  'quotes.view',
  'quotes.create',
  'quotes.send',
  'quotes.approve',
  'invoices.*',
  'invoices.view',
  'invoices.create',
  'invoices.send',
  'invoices.mark_paid',
  'financials.*',
  'financials.view',
  'financials.export',
  'employees.*',
  'employees.manage',
  'settings.*',
  'settings.billing',
  'settings.company',
  'settings.permissions',
  'crm.*',
  'crm.view',
  'crm.manage',
  'reports.*',
  'reports.view',
  'reports.export',
  'messaging.*',
  'messaging.view',
  'messaging.send',
  'documents.*',
  'documents.view',
  'documents.upload',
];

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadUserRolePermissions(companyId: string, userId: string) {
    return this.prisma.userRole.findMany({
      where: {
        companyId,
        userId,
        deletedAt: null,
      },
      select: {
        role: {
          select: {
            permissions: {
              where: { deletedAt: null },
              select: {
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async getUserPermissions(
    companyId: string,
    userId: string,
  ): Promise<string[]> {
    let roles;
    try {
      roles = await this.loadUserRolePermissions(companyId, userId);
    } catch (error) {
      // Recover from transient dropped DB connections and retry once.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P1017'
      ) {
        await this.prisma.$disconnect();
        await this.prisma.$connect();
        roles = await this.loadUserRolePermissions(companyId, userId);
      } else {
        throw error;
      }
    }

    const set = new Set<string>();
    for (const roleAssignment of roles) {
      for (const item of roleAssignment.role.permissions) {
        set.add(item.permission.key);
      }
    }

    return [...set];
  }

  listAllPermissions() {
    return ALL_PERMISSION_KEYS.map((key) => ({ key }));
  }

  async listRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId, deletedAt: null },
      include: {
        permissions: {
          where: { deletedAt: null },
          include: {
            permission: { select: { id: true, key: true, description: true } },
          },
        },
        _count: { select: { userRoles: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getRole(companyId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId, deletedAt: null },
      include: {
        permissions: {
          where: { deletedAt: null },
          include: {
            permission: { select: { id: true, key: true, description: true } },
          },
        },
        userRoles: {
          where: { deletedAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(companyId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { companyId, name: dto.name, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { companyId, name: dto.name, description: dto.description },
      });

      if (dto.permissionKeys?.length) {
        await this.upsertAndAssignPermissions(
          tx,
          companyId,
          role.id,
          dto.permissionKeys,
        );
      }

      return tx.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  async updateRole(companyId: string, roleId: string, dto: CreateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId, deletedAt: null },
      select: { id: true, isSystem: true },
    });

    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: { name: dto.name, description: dto.description },
      });

      if (dto.permissionKeys !== undefined) {
        await tx.rolePermission.updateMany({
          where: { roleId, companyId },
          data: { deletedAt: new Date() },
        });

        if (dto.permissionKeys.length) {
          await this.upsertAndAssignPermissions(
            tx,
            companyId,
            roleId,
            dto.permissionKeys,
          );
        }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  async deleteRole(companyId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId, deletedAt: null },
      select: { id: true, isSystem: true },
    });

    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.role.update({
      where: { id: roleId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async assignPermissionsToRole(
    companyId: string,
    roleId: string,
    dto: AssignPermissionsDto,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.$transaction(async (tx) => {
      await this.upsertAndAssignPermissions(
        tx,
        companyId,
        roleId,
        dto.permissionKeys,
      );
    });

    return this.getRole(companyId, roleId);
  }

  async removePermissionFromRole(
    companyId: string,
    roleId: string,
    permissionKey: string,
  ) {
    const permission = await this.prisma.permission.findFirst({
      where: { companyId, key: permissionKey, deletedAt: null },
      select: { id: true },
    });

    if (!permission) throw new NotFoundException('Permission not found');

    await this.prisma.rolePermission.updateMany({
      where: { companyId, roleId, permissionId: permission.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async assignRoleToUser(companyId: string, userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null }, select: { id: true } }),
      this.prisma.role.findFirst({ where: { id: roleId, companyId, deletedAt: null }, select: { id: true } }),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.userRole.upsert({
      where: { companyId_userId_roleId: { companyId, userId, roleId } },
      create: { companyId, userId, roleId },
      update: { deletedAt: null },
    });
  }

  async removeRoleFromUser(companyId: string, userId: string, roleId: string) {
    await this.prisma.userRole.updateMany({
      where: { companyId, userId, roleId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getUserRoles(companyId: string, userId: string) {
    return this.prisma.userRole.findMany({
      where: { companyId, userId, deletedAt: null },
      include: {
        role: {
          include: {
            permissions: {
              where: { deletedAt: null },
              include: { permission: { select: { key: true } } },
            },
          },
        },
      },
    });
  }

  private async upsertAndAssignPermissions(
    tx: any,
    companyId: string,
    roleId: string,
    permissionKeys: string[],
  ) {
    for (const key of permissionKeys) {
      const permission = await tx.permission.upsert({
        where: { companyId_key: { companyId, key } },
        create: { companyId, key, description: `Permission: ${key}` },
        update: { deletedAt: null },
      });

      await tx.rolePermission.upsert({
        where: {
          companyId_roleId_permissionId: {
            companyId,
            roleId,
            permissionId: permission.id,
          },
        },
        create: { companyId, roleId, permissionId: permission.id },
        update: { deletedAt: null },
      });
    }
  }
}
