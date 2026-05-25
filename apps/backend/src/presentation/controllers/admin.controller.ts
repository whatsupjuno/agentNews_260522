import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from '../../application/use-cases/admin.service';
import { UpdateUserSequenceDto } from '../dto/admin.dto';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  async listUsers(@Query('q') q?: string) {
    return { users: await this.admin.listUsers(q) };
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users/:id/block')
  @HttpCode(204)
  async block(@Param('id') id: string) {
    await this.admin.blockUser(id);
  }

  @Delete('users/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.admin.deleteUser(id);
  }

  @Post('users/:id/sequence')
  @HttpCode(204)
  async updateSequence(@Param('id') id: string, @Body() dto: UpdateUserSequenceDto) {
    await this.admin.updateUserSequence(id, dto.sequence);
  }

  @Get('chats')
  async listChats() {
    return { chats: await this.admin.listChats() };
  }

  @Delete('chats/:pairingId')
  @HttpCode(204)
  async removeChat(@Param('pairingId') pairingId: string) {
    await this.admin.deleteChat(pairingId);
  }

  /** 현재 로그인한 agent 가 admin 인지 확인 (mobile 측 시퀀스 분기 용). */
  @Get('me/whoami')
  whoami() {
    return { isAdmin: true };
  }
}
