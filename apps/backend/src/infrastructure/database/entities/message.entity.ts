import { Column, Entity } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('messages')
export class MessageEntity extends SoftDeletableEntity {
  @Column({ type: 'uuid', name: 'external_id', unique: true })
  externalId!: string;

  @Column({ type: 'bigint', name: 'pairing_id' })
  pairingId!: string;

  @Column({ type: 'bigint', name: 'sender_agent_id' })
  senderAgentId!: string;

  @Column({ type: 'varchar', length: 32, default: 'SENT' })
  status!: 'SENT' | 'DELETED';

  @Column({ type: 'bytea' })
  ciphertext!: Buffer;

  @Column({ type: 'bytea' })
  iv!: Buffer;

  @Column({ type: 'bytea' })
  tag!: Buffer;

  @Column({ type: 'boolean', name: 'has_attachment', default: false })
  hasAttachment!: boolean;

  @Column({ type: 'timestamptz', name: 'sent_at' })
  sentAt!: Date;

  @Column({ type: 'timestamptz', name: 'read_at', nullable: true })
  readAt!: Date | null;
}
