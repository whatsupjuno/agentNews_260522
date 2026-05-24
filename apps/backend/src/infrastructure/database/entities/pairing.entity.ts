import { Column, Entity } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('pairings')
export class PairingEntity extends SoftDeletableEntity {
  @Column({ type: 'uuid', name: 'external_id', unique: true })
  externalId!: string;

  @Column({ type: 'bigint', name: 'requester_agent_id' })
  requesterAgentId!: string;

  @Column({ type: 'bigint', name: 'recipient_agent_id' })
  recipientAgentId!: string;

  @Column({ type: 'varchar', length: 32, default: 'PAIRING_REQUESTED' })
  status!: 'PAIRING_REQUESTED' | 'PAIRED' | 'PAIRING_REJECTED' | 'DISCONNECTED';

  @Column({ type: 'timestamptz', name: 'requested_at' })
  requestedAt!: Date;

  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'bigint', name: 'ended_by_agent_id', nullable: true })
  endedByAgentId!: string | null;
}
