import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateParticipantsDto } from './dto/update-participants.dto';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectConversation(companyId: string, projectId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: { companyId, projectId, type: MessageType.PROJECT, deletedAt: null },
      include: { participants: true },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        companyId,
        projectId,
        type: MessageType.PROJECT,
      },
    });
  }

  async createConversation(
    companyId: string,
    creatorId: string,
    dto: CreateConversationDto,
  ) {
    const conversation = await this.prisma.conversation.create({
      data: {
        companyId,
        type: dto.type,
        projectId: dto.projectId,
        title: dto.title,
      },
    });

    const participantIds = new Set<string>([creatorId, ...(dto.participantIds ?? [])]);

    await this.prisma.conversationParticipant.createMany({
      data: Array.from(participantIds).map((userId) => ({
        companyId,
        conversationId: conversation.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        participants: true,
        project: { select: { id: true, name: true } },
      },
    });
  }

  async listConversations(companyId: string, userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { type: MessageType.PROJECT },
          { participants: { some: { userId, deletedAt: null } } },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { firstName: true, lastName: true } },
          },
        },
        participants: {
          where: { deletedAt: null },
          include: {
            conversation: false,
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async sendMessage(companyId: string, senderId: string, dto: SendMessageDto) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: dto.conversationId,
        companyId,
        deletedAt: null,
      },
      select: { id: true, projectId: true },
    });

    if (!conversation) {
      throw new ForbiddenException('Conversation not found for tenant');
    }

    const message = await this.prisma.message.create({
      data: {
        companyId,
        conversationId: dto.conversationId,
        senderId,
        body: dto.body ?? '',
        attachments: dto.attachments?.length
          ? {
              create: dto.attachments.map((att) => ({
                companyId,
                projectId: conversation.projectId,
                uploaderId: senderId,
                fileKey: att.fileKey,
                fileName: att.fileName,
                contentType: att.contentType,
                sizeBytes: att.sizeBytes,
                type: att.contentType.startsWith('image/')
                  ? DocumentType.PHOTO
                  : DocumentType.OTHER,
              })),
            }
          : undefined,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        attachments: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(
    companyId: string,
    conversationId: string,
    query: PaginationQueryDto,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const limit = Math.min(query.limit, 100);
    const skip = (query.page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { companyId, conversationId, deletedAt: null },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          receipts: { where: { readAt: { not: null } }, select: { userId: true, readAt: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { companyId, conversationId, deletedAt: null } }),
    ]);

    return { items: items.reverse(), meta: { page: query.page, limit, total } };
  }

  async addParticipants(
    companyId: string,
    conversationId: string,
    dto: UpdateParticipantsDto,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, companyId, deletedAt: null },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.prisma.conversationParticipant.createMany({
      data: dto.userIds.map((userId) => ({
        companyId,
        conversationId,
        userId,
      })),
      skipDuplicates: true,
    });

    return { success: true };
  }

  async removeParticipants(
    companyId: string,
    conversationId: string,
    dto: UpdateParticipantsDto,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, companyId, deletedAt: null },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.prisma.conversationParticipant.updateMany({
      where: {
        companyId,
        conversationId,
        userId: { in: dto.userIds },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async markRead(companyId: string, conversationId: string, userId: string) {
    const messages = await this.prisma.message.findMany({
      where: { companyId, conversationId, deletedAt: null },
      select: { id: true },
    });

    await Promise.all(
      messages.map((msg) =>
        this.prisma.messageReceipt.upsert({
          where: { companyId_messageId_userId: { companyId, messageId: msg.id, userId } },
          create: { companyId, messageId: msg.id, userId, readAt: new Date() },
          update: { readAt: new Date() },
        }),
      ),
    );

    return { success: true };
  }
}
