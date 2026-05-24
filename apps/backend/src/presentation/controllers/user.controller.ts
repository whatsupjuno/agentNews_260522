import { Body, Controller, Delete, Get, HttpCode, Patch, Req, UseGuards } from '@nestjs/common';
import { UserService } from '../../application/use-cases/user.service';
import { UpdateMeDto } from '../dto/user.dto';
import { AuthedRequest, JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  me(@Req() req: AuthedRequest) {
    return this.users.me(req.agent.id);
  }

  @Patch()
  update(@Req() req: AuthedRequest, @Body() dto: UpdateMeDto) {
    return this.users.update(req.agent.id, dto);
  }

  @Delete()
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest) {
    await this.users.deleteMe(req.agent.id);
  }
}
