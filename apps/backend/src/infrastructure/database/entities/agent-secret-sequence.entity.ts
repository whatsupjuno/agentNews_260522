import { Column, Entity } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('agent_secret_sequences')
export class AgentSecretSequenceEntity extends SoftDeletableEntity {
  @Column({ type: 'bigint', name: 'agent_id' })
  agentId!: string;

  @Column({ type: 'varchar', length: 32, default: 'NOT_REGISTERED' })
  status!: 'NOT_REGISTERED' | 'REGISTERED' | 'RESET_PENDING';

  @Column({ type: 'smallint', name: 'sequence_length', nullable: true })
  sequenceLength!: number | null;

  @Column({ type: 'bytea', nullable: true })
  hash!: Buffer | null;

  @Column({ type: 'bytea', nullable: true })
  salt!: Buffer | null;

  @Column({ type: 'timestamptz', name: 'registered_at', nullable: true })
  registeredAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'reset_requested_at', nullable: true })
  resetRequestedAt!: Date | null;
}
