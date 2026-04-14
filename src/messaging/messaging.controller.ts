import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type {
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Permissions('messaging.*', 'messaging.view')
  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations for current user' })
  listConversations(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
  ) {
    return this.messagingService.listConversations(tenant.companyId, user.userId);
  }

  @Permissions('messaging.*', 'messaging.send')
  @Post('conversations')
  @ApiOperation({ summary: 'Create a new conversation (direct or project channel)' })
  createConversation(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagingService.createConversation(
      tenant.companyId,
      user.userId,
      dto,
    );
  }

  @Permissions('messaging.*', 'messaging.view')
  @Get('projects/:projectId/conversation')
  @ApiOperation({ summary: 'Get or create project channel conversation' })
  getProjectConversation(
    @Tenant() tenant: RequestTenant,
    @Param('projectId') projectId: string,
  ) {
    return this.messagingService.getProjectConversation(tenant.companyId, projectId);
  }

  @Permissions('messaging.*', 'messaging.view')
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  getMessages(
    @Tenant() tenant: RequestTenant,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.messagingService.getMessages(tenant.companyId, id, query);
  }

  @Permissions('messaging.*', 'messaging.send')
  @Post('messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async sendMessage(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendMessage(
      tenant.companyId,
      user.userId,
      dto,
    );
    this.messagingGateway.publishConversationMessage(dto.conversationId, message);
    return message;
  }

  @Permissions('messaging.*', 'messaging.view')
  @Put('conversations/:id/read')
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  markRead(
    @Tenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.messagingService.markRead(tenant.companyId, id, user.userId);
  }
}
