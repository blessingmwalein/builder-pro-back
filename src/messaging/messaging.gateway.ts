import {
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer()
  server!: Server;

  afterInit(server: Server) {
    server.use(async (socket, next) => {
      try {
        const authorization =
          (socket.handshake.auth?.token as string | undefined) ??
          (socket.handshake.headers.authorization as string | undefined);

        if (!authorization) {
          return next(new Error('Missing authorization token'));
        }

        const token = authorization.startsWith('Bearer ')
          ? authorization.slice(7)
          : authorization;
        const jwtSecret = this.configService.get<string>('auth.jwtSecret') ?? 'change-me';
        const payload = verify(token, jwtSecret) as {
          sub: string;
          companyId: string;
          email: string;
        };

        const tenantSlugHeader = socket.handshake.headers['x-tenant-slug'];
        const tenantSlug = Array.isArray(tenantSlugHeader)
          ? tenantSlugHeader[0]
          : tenantSlugHeader;

        if (tenantSlug) {
          const company = await this.prisma.company.findFirst({
            where: { slug: tenantSlug, isActive: true, deletedAt: null },
            select: { id: true },
          });

          if (!company || company.id !== payload.companyId) {
            return next(new Error('Tenant mismatch'));
          }
        }

        socket.data.userId = payload.sub;
        socket.data.companyId = payload.companyId;
        socket.data.email = payload.email;

        return next();
      } catch {
        return next(new Error('Invalid authorization token'));
      }
    });
  }

  @SubscribeMessage('join-project')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string },
  ) {
    const companyId = client.data.companyId as string | undefined;
    if (!companyId) {
      throw new WsException('Unauthorized');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: payload.projectId, companyId, deletedAt: null },
      select: { id: true },
    });

    if (!project) {
      throw new WsException('Project not found for tenant');
    }

    client.join(`project:${payload.projectId}`);
    return { event: 'joined-project', data: payload };
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const companyId = client.data.companyId as string | undefined;
    if (!companyId) {
      throw new WsException('Unauthorized');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: payload.conversationId,
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!conversation) {
      throw new WsException('Conversation not found for tenant');
    }

    client.join(`conversation:${payload.conversationId}`);
    return { event: 'joined-conversation', data: payload };
  }

  publishConversationMessage(conversationId: string, payload: unknown) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('conversation-message', payload);
  }
}
