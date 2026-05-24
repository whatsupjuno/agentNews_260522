import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { PairingEntity } from '../../infrastructure/database/entities';

/**
 * WebSocket gateway — handshake 시 JWT access token + unlock token 둘 다 검증.
 * unlock token 없으면 채팅 채널 접근 불가 (REQ-015 / SEC-005).
 * 클라이언트의 join/subscribe 이벤트는 핸들러 미등록 (자동 join 만).
 */
@Injectable()
@WebSocketGateway({ path: '/ws', cors: { origin: true } })
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessageGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(PairingEntity) private readonly pairings: Repository<PairingEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const accessToken =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined) ??
      '';
    const unlockToken =
      (client.handshake.auth?.unlockToken as string | undefined) ??
      (client.handshake.query?.unlockToken as string | undefined) ??
      '';

    if (!accessToken || !unlockToken) {
      this.logger.warn(`ws: missing token(s) — access=${!!accessToken} unlock=${!!unlockToken}`);
      client.disconnect(true);
      return;
    }

    let agentId: string;
    try {
      const accessPayload = await this.jwt.verifyAsync(accessToken, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      agentId = String(accessPayload.agentId);
    } catch (e) {
      this.logger.warn(`ws: access handshake failed: ${(e as Error).message}`);
      client.disconnect(true);
      return;
    }

    try {
      const unlockPayload = await this.jwt.verifyAsync(unlockToken, {
        secret: this.config.get<string>('JWT_UNLOCK_SECRET'),
      });
      // unlock token 의 sub 가 access token 의 agentId 와 일치해야 함 (cross-token reuse 차단)
      if (unlockPayload.kind !== 'unlock' || String(unlockPayload.sub) !== agentId) {
        throw new Error('unlock token agent mismatch');
      }
    } catch (e) {
      this.logger.warn(`ws: unlock handshake failed: ${(e as Error).message}`);
      client.disconnect(true);
      return;
    }

    const pair = await this.pairings.findOne({
      where: [
        { requesterAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
        { recipientAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
      ],
    });
    if (!pair) {
      client.disconnect(true);
      return;
    }
    await client.join(this.roomFor(pair.id));
    client.emit('connected', { pairingExternalId: pair.externalId });
    this.logger.log(`ws: agent=${agentId} joined pairing=${pair.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`ws: disconnect ${client.id}`);
  }

  broadcastToPairing(pairingId: string, payload: unknown): void {
    this.server.to(this.roomFor(pairingId)).emit('message', payload);
  }

  private roomFor(pairingId: string): string {
    return `pairing:${pairingId}`;
  }
}
