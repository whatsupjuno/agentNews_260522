import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AgentEntity, AgentSecretSequenceEntity } from '../database/entities';
import { CryptoService } from '../crypto/crypto.service';
import { EchoBotService } from './echo-bot.service';

export const DEMO_USER_ID = 'demo';
export const DEMO_PASSWORD = 'demo1234';

/**
 * 부팅 시 데모 계정 1개 자동 생성.
 * - userId: demo / password: demo1234
 * - echo bot 페어링 + [5,3,1,7] 자동 등록
 *
 * 로그인 화면의 "데모 계정으로 로그인" 버튼이 이 자격으로 즉시 로그인.
 */
@Injectable()
export class DemoAccountService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoAccountService.name);

  constructor(
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    @InjectRepository(AgentSecretSequenceEntity)
    private readonly sequences: Repository<AgentSecretSequenceEntity>,
    private readonly crypto: CryptoService,
    private readonly echoBot: EchoBotService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.agents.findOne({
      where: { email: DEMO_USER_ID, deletedAt: IsNull() },
    });
    if (existing) {
      this.logger.log(`demo account ready: ${existing.id} (${DEMO_USER_ID})`);
      return;
    }

    const passwordHash = await this.crypto.hashPassword(DEMO_PASSWORD);
    const agent = await this.agents.save(
      this.agents.create({
        externalId: this.crypto.newUuid(),
        email: DEMO_USER_ID,
        passwordHash,
        nickname: '데모',
        status: 'ACTIVE',
      }),
    );

    await this.sequences.save(
      this.sequences.create({ agentId: agent.id, status: 'NOT_REGISTERED' }),
    );

    await this.echoBot.attachToNewAgent(agent.id);

    this.logger.log(`demo account created: ${agent.id} (${DEMO_USER_ID} / ${DEMO_PASSWORD})`);
  }
}
