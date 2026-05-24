import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('refresh_tokens')
export class RefreshTokenEntity extends BaseEntity {
  @Column({ type: 'bigint', name: 'agent_id' })
  agentId!: string;

  @Column({ type: 'uuid', name: 'token_jti', unique: true })
  tokenJti!: string;

  @Column({ type: 'varchar', length: 120, name: 'device_label', nullable: true })
  deviceLabel!: string | null;

  @Column({ type: 'timestamptz', name: 'issued_at' })
  issuedAt!: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;
}
