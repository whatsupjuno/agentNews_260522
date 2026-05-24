import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from '../../application/use-cases/auth.service';
import { LoginDto, RefreshDto, RegisterDto } from '../dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Headers('x-refresh-token') headerToken: string | undefined, @Body() dto?: RefreshDto) {
    const token = headerToken ?? dto?.refreshToken ?? '';
    return this.auth.refresh(token);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Headers('x-refresh-token') headerToken: string | undefined, @Body() dto?: RefreshDto) {
    const token = headerToken ?? dto?.refreshToken ?? '';
    await this.auth.logout(token);
  }
}
