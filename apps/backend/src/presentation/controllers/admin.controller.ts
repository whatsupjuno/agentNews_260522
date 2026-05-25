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
import { SequenceConfigService } from '../../application/use-cases/sequence-config.service';
import { UpdateUserSequenceDto } from '../dto/admin.dto';
import { SetSequenceConfigDto } from '../dto/sequence-config.dto';
import { AdminGuard } from '../guards/admin.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly seqConfig: SequenceConfigService,
  ) {}

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

  /** 글로벌 ARM 시퀀스 조회 / 변경 (chat / admin) */
  @Get('sequence/config')
  getSequenceConfig() {
    return this.seqConfig.getConfig();
  }

  @Post('sequence/config')
  async setSequenceConfig(@Body() dto: SetSequenceConfigDto) {
    const r = await this.seqConfig.setSequence(dto.kind, dto.sequence);
    return { ...this.seqConfig.getConfig(), updatedUsers: r.updatedUsers };
  }

  @Get('me/whoami')
  whoami() {
    return { isAdmin: true };
  }
}
