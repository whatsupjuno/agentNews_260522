import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthedRequest } from './jwt-auth.guard';

export interface UnlockedRequest extends AuthedRequest {
  unlock: { jti: string };
}

@Injectable()
export class UnlockTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<UnlockedRequest>();
    const header = req.headers['x-unlock-token'];
    if (!header || typeof header !== 'string') {
      // 위장 응답 — DisguiseExceptionFilter 가 404 로 변환
      throw new UnauthorizedException({ code: 'UNLOCK_TOKEN_EXPIRED', message: 'unlock' });
    }
    try {
      const payload = await this.jwt.verifyAsync(header, {
        secret: this.config.get<string>('JWT_UNLOCK_SECRET'),
      });
      req.unlock = { jti: String(payload.jti) };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNLOCK_TOKEN_EXPIRED', message: 'unlock' });
    }
  }
}
