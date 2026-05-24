import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AuthedRequest extends Request {
  agent: { id: string; externalId: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_EXPIRED', message: '세션이 만료되었습니다.' });
    }
    const token = header.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      req.agent = { id: String(payload.agentId), externalId: String(payload.sub) };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_EXPIRED', message: '세션이 만료되었습니다.' });
    }
  }
}
