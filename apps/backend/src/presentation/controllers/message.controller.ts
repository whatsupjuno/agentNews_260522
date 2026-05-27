import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MessageService } from '../../application/use-cases/message.service';
import { SendMessageDto } from '../dto/message.dto';
import { AuthedRequest, JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UnlockTokenGuard } from '../guards/unlock-token.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard, UnlockTokenGuard)
export class MessageController {
  constructor(private readonly messages: MessageService) {}

  @Get()
  async list(@Req() req: AuthedRequest, @Query('before') before?: string) {
    return { messages: await this.messages.listForAgent(req.agent.id, before) };
  }

  @Post()
  async send(@Req() req: AuthedRequest, @Body() dto: SendMessageDto) {
    const msg = await this.messages.send(req.agent.id, dto.body);
    void this.messages.maybeEchoReply(req.agent.id, dto.body);
    return msg;
  }

  @Post('read')
  async markRead(@Req() req: AuthedRequest) {
    return this.messages.markPeerMessagesRead(req.agent.id);
  }
}
