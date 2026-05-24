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
 * WebSocket gateway — handshake 시 JWT access token 검증 후 자동으로
 * `pairing:<id>` room join (SEC-005). 클라이언트의 join 이벤트 불수용.
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
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined) ??
      '';
    if (!token) {
      client.emit('error', { code: 'NEWS_ARTICLE_NOT_FOUND' });
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      const agentId = String(payload.agentId);
      const pair = await this.pairings.findOne({
        where: [
          { requesterAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
          { recipientAgentId: agentId, status: 'PAIRED', deletedAt: IsNull() },
        ],
      });
      if (pair) {
        await client.join(this.roomFor(pair.id));
        client.emit('connected', { pairingExternalId: pair.externalId });
        this.logger.log(`ws: agent=${agentId} joined pairing=${pair.id}`);
      }
    } catch (e) {
      this.logger.warn(`ws: handshake failed: ${(e as Error).message}`);
      client.disconnect(true);
    }
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
