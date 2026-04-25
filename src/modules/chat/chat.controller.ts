import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators';

class SendMessageDto {
  @ApiProperty({ example: 'Show me all projects' })
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conversationId?: string;
}

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send message to AI Lab Assistant (SSE stream)' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: SendMessageDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    let conversationId = dto.conversationId;
    if (!conversationId) {
      const conv = await this.chatService.createConversation(userId);
      conversationId = conv.id;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const stream$ = await this.chatService.sendMessage(
      conversationId,
      userId,
      role,
      dto.content,
    );

    const subscription = stream$.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      error: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      },
      complete: () => {
        res.write(`data: [DONE]\n\n`);
        res.end();
      },
    });

    res.on('close', () => {
      subscription.unsubscribe();
    });
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
