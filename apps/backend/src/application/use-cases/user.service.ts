import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import {
  AgentEntity,
  MessageEntity,
  PairingEntity,
} from '../../infrastructure/database/entities';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    @InjectRepository(PairingEntity) private readonly pairings: Repository<PairingEntity>,
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
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
      email: agent.email,
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
    // soft delete agent + cascade pair / messages (hard delete messages)
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
