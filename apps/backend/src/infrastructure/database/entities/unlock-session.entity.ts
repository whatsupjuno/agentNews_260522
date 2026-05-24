import { Column, Entity } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('unlock_sessions')
export class UnlockSessionEntity extends SoftDeletableEntity {
  @Column({ type: 'bigint', name: 'agent_id' })
  agentId!: string;

  @Column({ type: 'uuid', name: 'token_jti', unique: true })
  tokenJti!: string;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'EXPIRED' | 'REVOKED';

  @Column({ type: 'timestamptz', name: 'issued_at' })
  issuedAt!: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt!: Date;

  @Column({ type: 'varchar', length: 32, name: 'revoked_reason', nullable: true })
  revokedReason!: 'BACKGROUND' | 'LOGOUT' | 'APP_RESTART' | 'PAIR_DISCONNECT' | 'NEW_UNLOCK' | null;
}
