import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  AgentEntity,
  AgentSecretSequenceEntity,
  MessageEntity,
  PairingEntity,
} from '../database/entities';
import { CryptoService } from '../crypto/crypto.service';

export const ECHO_BOT_EMAIL_SUFFIX = '@bot.dailynews.local';
export const DEMO_SEQUENCE = [5, 3, 1, 7] as const;

/**
 * Demo mode: 회원가입한 모든 사용자에게 자동으로 echo bot 1명 페어링.
 * 1인 self-test 가 가능하도록.
 *
 * 사용자마다 전용 bot 생성 (REQ-014: 1 agent = 1 active pair → bot 1명 = 1 user 만).
 *
 * - AuthService.register 종료 직전 `attachToNewAgent(agentId)` 호출
 *   → 전용 bot 1명 생성 → [5,3,1,7] 자동 등록 → PAIRED → 시드 메시지 2개
 */
@Injectable()
export class EchoBotService {
  private readonly logger = new Logger(EchoBotService.name);

  constructor(
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    @InjectRepository(AgentSecretSequenceEntity)
    private readonly sequences: Repository<AgentSecretSequenceEntity>,
    @InjectRepository(PairingEntity) private readonly pairings: Repository<PairingEntity>,
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    private readonly crypto: CryptoService,
  ) {}

  async attachToNewAgent(agentId: string): Promise<void> {
    // 1. 사용자 전용 bot 생성
    const botUuid = this.crypto.newUuid();
    const bot = await this.agents.save(
      this.agents.create({
        externalId: botUuid,
        email: `echo-${botUuid}${ECHO_BOT_EMAIL_SUFFIX}`,
        passwordHash: 'BOT_NO_LOGIN',
        nickname: '에코봇',
        status: 'ACTIVE',
      }),
    );
    this.logger.log(`echo bot created for agent=${agentId}: bot=${bot.id}`);

    // 2. 시퀀스 등록 [5,3,1,7]
    const seqRow = await this.sequences.findOne({
      where: { agentId, deletedAt: IsNull() },
    });
    if (seqRow) {
      const { hash, salt } = this.crypto.hashSequence([...DEMO_SEQUENCE]);
      seqRow.hash = hash;
      seqRow.salt = salt;
      seqRow.sequenceLength = DEMO_SEQUENCE.length;
      seqRow.status = 'REGISTERED';
      seqRow.registeredAt = new Date();
      await this.sequences.save(seqRow);
    }

    // 3. pairing 생성 — bot 이 requester, user 가 recipient
    const pair = await this.pairings.save(
      this.pairings.create({
        externalId: this.crypto.newUuid(),
        requesterAgentId: bot.id,
        recipientAgentId: agentId,
        status: 'PAIRED',
        requestedAt: new Date(),
        acceptedAt: new Date(),
      }),
    );

    // 4. 시드 메시지 2개 (봇이 보낸 것)
    const seedTexts = [
      '🤖 안녕! 나는 에코봇이야. 이 화면이 보인다면 잠금 해제 성공!',
      '🤖 아무거나 댓글 입력하면 내가 응답해줄게.',
    ];
    for (const text of seedTexts) {
      const { ciphertext, iv, tag } = this.crypto.encryptMessage(text);
      await this.messages.save(
        this.messages.create({
          externalId: this.crypto.newUuid(),
          pairingId: pair.id,
          senderAgentId: bot.id,
          ciphertext,
          iv,
          tag,
          hasAttachment: false,
          sentAt: new Date(),
          status: 'SENT',
        }),
      );
    }
    this.logger.log(`demo seed attached: agent=${agentId} pair=${pair.id} bot=${bot.id}`);
  }
}
