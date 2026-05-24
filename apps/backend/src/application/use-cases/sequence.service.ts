import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import {
  AgentSecretSequenceEntity,
  UnlockSessionEntity,
} from '../../infrastructure/database/entities';

@Injectable()
export class SequenceService {
  constructor(
    @InjectRepository(AgentSecretSequenceEntity)
    private readonly sequences: Repository<AgentSecretSequenceEntity>,
    @InjectRepository(UnlockSessionEntity)
    private readonly unlockSessions: Repository<UnlockSessionEntity>,
    private readonly crypto: CryptoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 시퀀스 등록 / 갱신. Phase 1 데모 — 회원가입 직후 자동 호출.
   */
  async register(agentId: string, sequence: number[]): Promise<void> {
    const row = await this.sequences.findOne({ where: { agentId, deletedAt: IsNull() } });
    if (!row) {
      throw new NotFoundException({ code: 'SEQUENCE_NOT_FOUND', message: '시퀀스 없음' });
    }
    const { hash, salt } = this.crypto.hashSequence(sequence);
    row.hash = hash;
    row.salt = salt;
    row.sequenceLength = sequence.length;
    row.status = 'REGISTERED';
    row.registeredAt = new Date();
    await this.sequences.save(row);
  }

  /**
   * 시퀀스 검증 + unlock_token 발급. TTL 60분 (handoff §8.4).
   */
  async verify(
    agentId: string,
    sequence: number[],
  ): Promise<{ unlockToken: string; expiresAt: string }> {
    const row = await this.sequences.findOne({
      where: { agentId, status: 'REGISTERED', deletedAt: IsNull() },
    });
    if (!row || !row.hash || !row.salt) {
      throw new UnauthorizedException({ code: 'UNLOCK_REVOKED', message: 'unlock' });
    }
    const ok = this.crypto.verifySequence(sequence, row.hash, row.salt);
    if (!ok) {
      throw new UnauthorizedException({ code: 'UNLOCK_REVOKED', message: 'unlock' });
    }
    // 기존 ACTIVE unlock 모두 REVOKED → 새 발급
    await this.unlockSessions.update(
      { agentId, status: 'ACTIVE' },
      { status: 'REVOKED', revokedReason: 'NEW_UNLOCK' },
    );

    const jti = this.crypto.newUuid();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const unlockToken = await this.jwt.signAsync(
      { sub: agentId, jti, kind: 'unlock' },
      {
        secret: this.config.get<string>('JWT_UNLOCK_SECRET'),
        expiresIn: '60m',
      },
    );
    await this.unlockSessions.save(
      this.unlockSessions.create({
        agentId,
        tokenJti: jti,
        status: 'ACTIVE',
        issuedAt: new Date(),
        expiresAt,
        lastSeenAt: new Date(),
      }),
    );
    return { unlockToken, expiresAt: expiresAt.toISOString() };
  }
}
