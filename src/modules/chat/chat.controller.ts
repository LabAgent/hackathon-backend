import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Sse,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatService, ProgressEvent } from './chat.service';
import { CurrentUser } from '../../common/decorators';

class SendMessageDto {
  content: string;
  conversationId?: string;
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send message to AI Lab Assistant' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: SendMessageDto,
  ) {
    let conversationId = dto.conversationId;
    if (!conversationId) {
      const conv = await this.chatService.createConversation(userId);
      conversationId = conv.id;
    }

    const stream$ = await this.chatService.sendMessage(
      conversationId,
      userId,
      role,
      dto.content,
    );

    return {
      conversationId,
      stream: true,
    };
  }

  @Post('stream')
  @Sse()
  @ApiOperation({ summary: 'Send message and get SSE stream' })
  async sendMessageStream(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: SendMessageDto,
  ): Promise<Observable<MessageEvent>> {
    let conversationId = dto.conversationId;
    if (!conversationId) {
      const conv = await this.chatService.createConversation(userId);
      conversationId = conv.id;
    }

    const stream$ = await this.chatService.sendMessage(
      conversationId,
      userId,
      role,
      dto.content,
    );

    return stream$.pipe(
      map((event: ProgressEvent) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation with messages' })
  getConversation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getConversation(id, userId);
  }
}
