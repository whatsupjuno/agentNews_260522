import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthedRequest } from './jwt-auth.guard';

export interface UnlockedRequest extends AuthedRequest {
  unlock: { jti: string; agentId: string };
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
      throw new UnauthorizedException({ code: 'UNLOCK_TOKEN_EXPIRED', message: 'unlock' });
    }
    let payload: { sub?: string; jti?: string; kind?: string };
    try {
      payload = await this.jwt.verifyAsync(header, {
        secret: this.config.get<string>('JWT_UNLOCK_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({ code: 'UNLOCK_TOKEN_EXPIRED', message: 'unlock' });
    }

    // SEC-004 정합: unlock token 의 sub 가 현재 로그인 agent 와 일치해야 함.
    // 다른 사람의 unlock token 으로 자신의 채팅 접근 차단.
    if (payload.kind !== 'unlock' || !payload.sub || payload.sub !== req.agent.id) {
      throw new UnauthorizedException({ code: 'UNLOCK_REVOKED', message: 'unlock' });
    }

    req.unlock = { jti: String(payload.jti), agentId: String(payload.sub) };
    return true;
  }
}
