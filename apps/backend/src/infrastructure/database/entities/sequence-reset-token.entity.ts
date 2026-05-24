import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('sequence_reset_tokens')
export class SequenceResetTokenEntity extends BaseEntity {
  @Column({ type: 'bigint', name: 'agent_id' })
  agentId!: string;

  @Column({ type: 'bytea', name: 'token_hash', unique: true })
  tokenHash!: Buffer;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'consumed_at', nullable: true })
  consumedAt!: Date | null;
}
