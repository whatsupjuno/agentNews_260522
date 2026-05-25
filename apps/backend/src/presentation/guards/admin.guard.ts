import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AgentEntity } from '../../infrastructure/database/entities';
import { AuthedRequest } from './jwt-auth.guard';

/**
 * Admin guard — JwtAuthGuard 뒤에 적용.
 * ConfigService 의 ADMIN_USER_IDS 콤마 구분 목록 매칭.
 *
 * 예: ADMIN_USER_IDS=demo,jun_admin
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminIds: Set<string>;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
  ) {
    const raw = this.config.get<string>('ADMIN_USER_IDS') ?? '';
    this.adminIds = new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.agent?.id) {
      throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN', message: 'admin only' });
    }
    const agent = await this.agents.findOne({
      where: { id: req.agent.id, deletedAt: IsNull() },
    });
    if (!agent) {
      throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN', message: 'admin only' });
    }
    if (!this.adminIds.has(agent.email.toLowerCase())) {
      throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN', message: 'admin only' });
    }
    return true;
  }
}
