import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import { EchoBotService } from '../../infrastructure/demo/echo-bot.service';
import {
  AgentEntity,
  AgentSecretSequenceEntity,
  RefreshTokenEntity,
} from '../../infrastructure/database/entities';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { externalId: string; email: string; nickname: string };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    @InjectRepository(AgentSecretSequenceEntity)
    private readonly sequences: Repository<AgentSecretSequenceEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokens: Repository<RefreshTokenEntity>,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly echoBot: EchoBotService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    nickname: string;
    userId: string;
  }): Promise<AuthTokens> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.agents.findOne({ where: { email, deletedAt: IsNull() } });
    if (existing) {
      throw new ConflictException({ code: 'AUTH_EMAIL_DUPLICATE', message: '이미 가입된 이메일입니다.' });
    }

    const passwordHash = await this.crypto.hashPassword(dto.password);
    const externalId = this.crypto.newUuid();

    const agent = await this.agents.save(
      this.agents.create({
        externalId,
        email,
        passwordHash,
        nickname: dto.nickname,
        status: 'ACTIVE',
      }),
    );

    // 시퀀스 row 자동 생성 (NOT_REGISTERED).
    await this.sequences.save(
      this.sequences.create({ agentId: agent.id, status: 'NOT_REGISTERED' }),
    );

    // Demo mode — echo bot 자동 페어링 + [5,3,1,7] 자동 등록 + 시드 메시지 2개.
    await this.echoBot.attachToNewAgent(agent.id);

    return this.issueTokens(agent);
  }

  async login(dto: { email: string; password: string }): Promise<AuthTokens> {
    const email = dto.email.toLowerCase().trim();
    const agent = await this.agents.findOne({
      where: { email, status: 'ACTIVE', deletedAt: IsNull() },
    });
    if (!agent) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }
    const ok = await this.crypto.verifyPassword(dto.password, agent.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }
    return this.issueTokens(agent);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_EXPIRED', message: '세션이 만료되었습니다.' });
    }
    const stored = await this.refreshTokens.findOne({ where: { tokenJti: payload.jti } });
    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_REVOKED',
        message: '세션이 만료되었습니다.',
      });
    }
    const agent = await this.agents.findOne({
      where: { id: stored.agentId, status: 'ACTIVE', deletedAt: IsNull() },
    });
    if (!agent) {
      throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: '세션 오류.' });
    }
    // rotate
    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokens(agent);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.refreshTokens.update(
        { tokenJti: payload.jti },
        { revokedAt: new Date() },
      );
    } catch {
      // 만료된 토큰 logout 은 silent
    }
  }

  private async issueTokens(agent: AgentEntity): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: agent.externalId, agentId: agent.id, kind: 'access' },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    const jti = this.crypto.newUuid();
    const refreshToken = await this.jwt.signAsync(
      { sub: agent.externalId, agentId: agent.id, jti, kind: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      },
    );
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        agentId: agent.id,
        tokenJti: jti,
        issuedAt: new Date(),
        expiresAt,
      }),
    );
    return {
      accessToken,
      refreshToken,
      user: { externalId: agent.externalId, email: agent.email, nickname: agent.nickname },
    };
  }
}
