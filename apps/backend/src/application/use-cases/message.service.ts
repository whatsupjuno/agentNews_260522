import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, LessThan } from 'typeorm';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import {
  MessageEntity,
  PairingEntity,
  AgentEntity,
} from '../../infrastructure/database/entities';
import { MessageGateway } from '../../presentation/gateways/message.gateway';

export interface DecryptedMessage {
  externalId: string;
  pairingExternalId: string;
  senderExternalId: string;
  senderNickname: string;
  body: string;
  hasAttachment: boolean;
  sentAt: string;
  fromMe?: boolean;
}

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    @InjectRepository(PairingEntity) private readonly pairings: Repository<PairingEntity>,
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    private readonly crypto: CryptoService,
    private readonly gateway: MessageGateway,
  ) {}

  async listForAgent(agentId: string, before?: string): Promise<DecryptedMessage[]> {
    const pair = await this.findActivePair(agentId);
    if (!pair) return [];
    const where: Record<string, unknown> = { pairingId: pair.id, deletedAt: IsNull() };
    if (before) {
      const beforeMsg = await this.messages.findOne({ where: { externalId: before } });
      if (beforeMsg) where.sentAt = LessThan(beforeMsg.sentAt);
    }
    const rows = await this.messages.find({
      where,
      order: { sentAt: 'ASC' },
      take: 200,
    });
    const senderIds = [...new Set(rows.map((r) => r.senderAgentId))];
    const senders = await this.agents.find({ where: { id: In(senderIds) } });
    const senderMap = new Map(senders.map((s) => [s.id, s]));
    return rows.map((r) => {
      const sender = senderMap.get(r.senderAgentId);
      return {
        externalId: r.externalId,
        pairingExternalId: pair.externalId,
        senderExternalId: sender?.externalId ?? '',
        senderNickname: sender?.nickname ?? '',
        body: this.crypto.decryptMessage(r.ciphertext, r.iv, r.tag),
        hasAttachment: r.hasAttachment,
        sentAt: r.sentAt.toISOString(),
        fromMe: r.senderAgentId === agentId,
      };
    });
  }

  async send(agentId: string, body: string): Promise<DecryptedMessage> {
    const pair = await this.findActivePair(agentId);
    if (!pair) {
      throw new NotFoundException({
        code: 'MESSAGE_PAIR_NOT_PAIRED',
        message: '연결된 구독자가 없습니다.',
      });
    }
    const { ciphertext, iv, tag } = this.crypto.encryptMessage(body);
    const externalId = this.crypto.newUuid();
    const now = new Date();
    const saved = await this.messages.save(
      this.messages.create({
        externalId,
        pairingId: pair.id,
        senderAgentId: agentId,
        ciphertext,
        iv,
        tag,
        hasAttachment: false,
        sentAt: now,
        status: 'SENT',
      }),
    );
    const sender = await this.agents.findOne({ where: { id: agentId } });
    const msg: DecryptedMessage = {
      externalId: saved.externalId,
      pairingExternalId: pair.externalId,
      senderExternalId: sender?.externalId ?? '',
      senderNickname: sender?.nickname ?? '',
      body,
      hasAttachment: false,
      sentAt: now.toISOString(),
      fromMe: true,
    };
    // WS broadcast to pairing channel (both sides). 클라이언트가 fromMe 직접 판단.
    this.gateway.broadcastToPairing(pair.id, {
      type: 'message',
      message: {
        ...msg,
        fromMe: undefined, // remove client-relative flag from broadcast
      },
    });
    return msg;
  }

  /** Echo bot trigger — pair.recipient 가 봇이면 자동 응답 1개 INSERT. */
  async maybeEchoReply(agentId: string, userBody: string): Promise<void> {
    const pair = await this.findActivePair(agentId);
    if (!pair) return;
    const other =
      pair.requesterAgentId === agentId ? pair.recipientAgentId : pair.requesterAgentId;
    const otherAgent = await this.agents.findOne({ where: { id: other } });
    if (!otherAgent || !otherAgent.email.endsWith('@bot.dailynews.local')) return;
    // bot reply, async delay 800ms
    setTimeout(() => {
      void this.directSend(other, pair, this.composeBotReply(userBody));
    }, 800);
  }

  private composeBotReply(userBody: string): string {
    const trimmed = userBody.trim();
    if (!trimmed) return '🤖 비어있는 댓글이네요';
    if (trimmed.length > 60) return `🤖 길게 적어주셨네요 — “${trimmed.slice(0, 30)}…”`;
    const replies = [
      `🤖 그렇구나, “${trimmed}”`,
      '🤖 응 알겠어',
      '🤖 좋은 생각이네',
      '🤖 ㅋㅋㅋ',
      '🤖 음 그건 좀 생각해봐야겠다',
      `🤖 “${trimmed}” — 동의!`,
    ];
    return replies[Math.floor(Math.random() * replies.length)]!;
  }

  private async directSend(
    senderAgentId: string,
    pair: PairingEntity,
    body: string,
  ): Promise<void> {
    const { ciphertext, iv, tag } = this.crypto.encryptMessage(body);
    const externalId = this.crypto.newUuid();
    const now = new Date();
    await this.messages.save(
      this.messages.create({
        externalId,
        pairingId: pair.id,
        senderAgentId,
        ciphertext,
        iv,
        tag,
        hasAttachment: false,
        sentAt: now,
        status: 'SENT',
      }),
    );
    const sender = await this.agents.findOne({ where: { id: senderAgentId } });
    this.gateway.broadcastToPairing(pair.id, {
      type: 'message',
      message: {
        externalId,
        pairingExternalId: pair.externalId,
        senderExternalId: sender?.externalId ?? '',
        senderNickname: sender?.nickname ?? '',
        body,
        hasAttachment: false,
        sentAt: now.toISOString(),
      },
    });
  }

  private async findActivePair(agentId: string): Promise<PairingEntity | null> {
    const pair = await this.pairings.findOne({
      where: [
        { requesterAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
        { recipientAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
      ],
    });
    return pair ?? null;
  }
}
