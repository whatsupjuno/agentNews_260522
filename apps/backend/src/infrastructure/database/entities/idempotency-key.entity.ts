import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Index(['agentId', 'keyValue'], { unique: true })
@Entity('idempotency_keys')
export class IdempotencyKeyEntity extends BaseEntity {
  @Column({ type: 'bigint', name: 'agent_id' })
  agentId!: string;

  @Column({ type: 'varchar', length: 255, name: 'key_value' })
  keyValue!: string;

  @Column({ type: 'bytea', name: 'request_hash' })
  requestHash!: Buffer;

  @Column({ type: 'smallint', name: 'response_status', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'jsonb', name: 'response_body', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;
}
