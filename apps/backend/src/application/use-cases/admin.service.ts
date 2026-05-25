import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, IsNull } from 'typeorm';
import { CryptoService } from '../../infrastructure/crypto/crypto.service';
import {
  AgentEntity,
  AgentSecretSequenceEntity,
  MessageEntity,
  PairingEntity,
} from '../../infrastructure/database/entities';

export interface AdminUserRow {
  id: string;
  userId: string;
  nickname: string;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  pairedWith: string | null; // 페어 userId
  messageCount: number;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface AdminChatRow {
  pairingId: string;
  pairingExternalId: string;
  a: { userId: string; nickname: string };
  b: { userId: string; nickname: string };
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AgentEntity) private readonly agents: Repository<AgentEntity>,
    @InjectRepository(AgentSecretSequenceEntity)
    private readonly sequences: Repository<AgentSecretSequenceEntity>,
    @InjectRepository(PairingEntity) private readonly pairings: Repository<PairingEntity>,
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    private readonly crypto: CryptoService,
  ) {}

  // ─── 사용자 ────────────────────────────────────────────────────────────────

  async listUsers(q?: string): Promise<AdminUserRow[]> {
    const where = q
      ? [{ email: Like(`%${q.toLowerCase()}%`) }, { nickname: Like(`%${q}%`) }]
      : {};
    const rows = await this.agents.find({ where, order: { createdAt: 'DESC' }, take: 200 });

    return Promise.all(rows.map((r) => this.toUserRow(r)));
  }

  async getUser(id: string): Promise<AdminUserRow> {
    const row = await this.agents.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    return this.toUserRow(row);
  }

  async blockUser(id: string): Promise<void> {
    const row = await this.agents.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    // status 컬럼은 ACTIVE/DELETED 만 허용. BLOCKED 는 별도 표현 — 일단 status='DELETED' 처리
    row.status = 'DELETED';
    row.deletedAt = new Date();
    await this.agents.save(row);
    // 페어 강제 해제
    await this.pairings.update(
      [{ requesterAgentId: id }, { recipientAgentId: id }],
      { status: 'DISCONNECTED', endedAt: new Date() },
    );
  }

  async deleteUser(id: string): Promise<void> {
    const row = await this.agents.findOne({ where: { id } });
    if (!row) throw new NotFoundException();
    // 메시지 hard delete + 페어 disconnect + agent soft delete
    const pairs = await this.pairings.find({
      where: [{ requesterAgentId: id }, { recipientAgentId: id }],
    });
    const pairIds = pairs.map((p) => p.id);
    if (pairIds.length > 0) {
      await this.messages.delete({ pairingId: In(pairIds) });
      await this.pairings.update(
        { id: In(pairIds) },
        { status: 'DISCONNECTED', endedAt: new Date() },
      );
    }
    row.status = 'DELETED';
    row.deletedAt = new Date();
    await this.agents.save(row);
  }

  // ─── 시퀀스 (per user) ─────────────────────────────────────────────────────

  async updateUserSequence(
    agentId: string,
    sequence: number[],
  ): Promise<{ updated: boolean }> {
    const row = await this.sequences.findOne({
      where: { agentId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException();
    const { hash, salt } = this.crypto.hashSequence(sequence);
    row.hash = hash;
    row.salt = salt;
    row.sequenceLength = sequence.length;
    row.status = 'REGISTERED';
    row.registeredAt = new Date();
    await this.sequences.save(row);
    return { updated: true };
  }

  // ─── 채팅 데이터 ───────────────────────────────────────────────────────────

  async listChats(): Promise<AdminChatRow[]> {
    const pairs = await this.pairings.find({
      order: { createdAt: 'DESC' },
      take: 200,
    });

    const result: AdminChatRow[] = [];
    for (const p of pairs) {
      const [a, b] = await Promise.all([
        this.agents.findOne({ where: { id: p.requesterAgentId } }),
        this.agents.findOne({ where: { id: p.recipientAgentId } }),
      ]);
      const msgCount = await this.messages.count({ where: { pairingId: p.id } });
      const lastMsg = await this.messages.findOne({
        where: { pairingId: p.id },
        order: { sentAt: 'DESC' },
      });
      result.push({
        pairingId: p.id,
        pairingExternalId: p.externalId,
        a: { userId: a?.email ?? '?', nickname: a?.nickname ?? '?' },
        b: { userId: b?.email ?? '?', nickname: b?.nickname ?? '?' },
        status: p.status,
        messageCount: msgCount,
        lastMessageAt: lastMsg?.sentAt.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      });
    }
    return result;
  }

  async deleteChat(pairingId: string): Promise<void> {
    const pair = await this.pairings.findOne({ where: { id: pairingId } });
    if (!pair) throw new NotFoundException();
    await this.messages.delete({ pairingId });
    pair.status = 'DISCONNECTED';
    pair.endedAt = new Date();
    await this.pairings.save(pair);
  }

  // ─── helper ────────────────────────────────────────────────────────────────

  private async toUserRow(row: AgentEntity): Promise<AdminUserRow> {
    const pair = await this.pairings.findOne({
      where: [
        { requesterAgentId: row.id, status: 'PAIRED', deletedAt: IsNull() },
        { recipientAgentId: row.id, status: 'PAIRED', deletedAt: IsNull() },
      ],
    });
    let pairedWith: string | null = null;
    let messageCount = 0;
    if (pair) {
      const peerId =
        pair.requesterAgentId === row.id ? pair.recipientAgentId : pair.requesterAgentId;
      const peer = await this.agents.findOne({ where: { id: peerId } });
      pairedWith = peer?.email ?? null;
      messageCount = await this.messages.count({ where: { pairingId: pair.id } });
    }
    return {
      id: row.id,
      userId: row.email,
      nickname: row.nickname,
      status: row.deletedAt ? 'DELETED' : (row.status as 'ACTIVE' | 'DELETED'),
      pairedWith,
      messageCount,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: null,
    };
  }
}
