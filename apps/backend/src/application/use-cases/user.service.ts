import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import {
  AgentEntity,
  MessageEntity,
  PairingEntity,
  PushTokenEntity,
} from '../../infrastructure/database/entities';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    @InjectRepository(PairingEntity) private readonly pairings: Repository<PairingEntity>,
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    @InjectRepository(PushTokenEntity) private readonly pushTokens: Repository<PushTokenEntity>,
  ) {}

  async me(agentId: string) {
    const agent = await this.agents.findOne({ where: { id: agentId, deletedAt: IsNull() } });
    if (!agent) throw new NotFoundException();
    const pair = await this.findActivePair(agentId);
    let peer = null as null | { externalId: string; nickname: string };
    if (pair) {
      const peerId =
        pair.requesterAgentId === agentId ? pair.recipientAgentId : pair.requesterAgentId;
      const peerAgent = await this.agents.findOne({ where: { id: peerId } });
      if (peerAgent) peer = { externalId: peerAgent.externalId, nickname: peerAgent.nickname };
    }
    return {
      externalId: agent.externalId,
      userId: agent.email,
      nickname: agent.nickname,
      pairCount: pair ? 1 : 0,
      peer,
      createdAt: agent.createdAt.toISOString(),
    };
  }

  async update(agentId: string, patch: { nickname?: string; statusMessage?: string }) {
    const agent = await this.agents.findOne({ where: { id: agentId, deletedAt: IsNull() } });
    if (!agent) throw new NotFoundException();
    if (patch.nickname) agent.nickname = patch.nickname;
    await this.agents.save(agent);
    return this.me(agentId);
  }

  async deleteMe(agentId: string): Promise<void> {
    const agent = await this.agents.findOne({ where: { id: agentId, deletedAt: IsNull() } });
    if (!agent) throw new NotFoundException();
    const pairs = await this.pairings.find({
      where: [{ requesterAgentId: agentId }, { recipientAgentId: agentId }],
    });
    const pairIds = pairs.map((p) => p.id);
    if (pairIds.length > 0) {
      await this.messages.delete({ pairingId: In(pairIds) });
      await this.pairings.update(
        { id: In(pairIds) },
        { status: 'DISCONNECTED', endedAt: new Date(), endedByAgentId: agentId },
      );
    }
    agent.status = 'DELETED';
    agent.deletedAt = new Date();
    await this.agents.save(agent);
  }

  /**
   * Expo Push Token 등록. 같은 agent + 같은 token = upsert.
   * `push_tokens.fcm_token` 컬럼에 Expo Push Token 저장 (의미 변환).
   */
  async registerPushToken(agentId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    const existing = await this.pushTokens.findOne({
      where: { fcmToken: token, deletedAt: IsNull() },
    });
    if (existing) {
      existing.agentId = agentId;
      existing.platform = platform;
      existing.lastSeenAt = new Date();
      await this.pushTokens.save(existing);
      return;
    }
    await this.pushTokens.save(
      this.pushTokens.create({
        agentId,
        fcmToken: token,
        platform,
        lastSeenAt: new Date(),
      }),
    );
  }

  /** 페어 상대의 active push token 들 반환 (fan-out 대상). */
  async getPeerPushTokens(agentId: string): Promise<string[]> {
    const pair = await this.findActivePair(agentId);
    if (!pair) return [];
    const peerId =
      pair.requesterAgentId === agentId ? pair.recipientAgentId : pair.requesterAgentId;
    const rows = await this.pushTokens.find({
      where: { agentId: peerId, deletedAt: IsNull() },
      order: { lastSeenAt: 'DESC' },
    });
    return rows.map((r) => r.fcmToken);
  }

  private async findActivePair(agentId: string): Promise<PairingEntity | null> {
    return (
      (await this.pairings.findOne({
        where: [
          { requesterAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
          { recipientAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
        ],
      })) ?? null
    );
  }
}
