import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import { AgentSecretSequenceEntity } from '../../infrastructure/database/entities';

const DEFAULT_CHAT = [5, 3, 1, 7];
const DEFAULT_ADMIN = [7, 1, 3, 5];

export type SequenceKind = 'chat' | 'admin';

interface Config {
  chat: number[];
  admin: number[];
}

/**
 * Global ARM sequence config.
 * - in-memory (서버 재시작 시 default 로 reset)
 * - chat sequence 변경 시 모든 active agent 의 secret_sequence hash 갱신 (cascade)
 * - admin sequence 변경은 mobile fetch 만으로 적용 (backend 검증 안 함)
 */
@Injectable()
export class SequenceConfigService {
  private readonly logger = new Logger(SequenceConfigService.name);
  private config: Config = { chat: [...DEFAULT_CHAT], admin: [...DEFAULT_ADMIN] };

  constructor(
    @InjectRepository(AgentSecretSequenceEntity)
    private readonly sequences: Repository<AgentSecretSequenceEntity>,
    private readonly crypto: CryptoService,
  ) {}

  getConfig(): Config {
    return { chat: [...this.config.chat], admin: [...this.config.admin] };
  }

  /**
   * 시퀀스 변경. chat 인 경우 모든 active agent 의 hash 도 갱신.
   * @returns 갱신된 사용자 수
   */
  async setSequence(kind: SequenceKind, sequence: number[]): Promise<{ updatedUsers: number }> {
    this.config[kind] = [...sequence];
    if (kind === 'admin') {
      this.logger.log(`admin sequence changed → [${sequence.join(',')}]`);
      return { updatedUsers: 0 };
    }
    // chat sequence: 모든 REGISTERED 사용자의 hash 갱신
    const rows = await this.sequences.find({
      where: { status: 'REGISTERED', deletedAt: IsNull() },
    });
    for (const row of rows) {
      const { hash, salt } = this.crypto.hashSequence(sequence);
      row.hash = hash;
      row.salt = salt;
      row.sequenceLength = sequence.length;
      row.registeredAt = new Date();
      await this.sequences.save(row);
    }
    this.logger.log(
      `chat sequence changed → [${sequence.join(',')}] (cascade ${rows.length} users)`,
    );
    return { updatedUsers: rows.length };
  }
}
