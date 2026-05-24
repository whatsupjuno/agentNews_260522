import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('notification_queue')
export class NotificationQueueEntity extends BaseEntity {
  @Column({ type: 'uuid', name: 'external_id', unique: true })
  externalId!: string;

  @Column({ type: 'bigint', name: 'recipient_agent_id' })
  recipientAgentId!: string;

  @Column({ type: 'varchar', length: 32, name: 'trigger_kind' })
  triggerKind!: 'MESSAGE_TEXT' | 'MESSAGE_IMAGE' | 'MESSAGE_FILE' | 'PAIRING_REQUEST' | 'PAIRING_REJECT';

  @Column({ type: 'bigint', name: 'trigger_message_id', nullable: true })
  triggerMessageId!: string | null;

  @Column({ type: 'bigint', name: 'trigger_pairing_id', nullable: true })
  triggerPairingId!: string | null;

  @Column({ type: 'bigint', name: 'fake_headline_id' })
  fakeHeadlineId!: string;

  @Column({ type: 'varchar', length: 32, default: 'QUEUED' })
  status!: 'QUEUED' | 'SENT' | 'FAILED';

  @Column({ type: 'timestamptz', name: 'scheduled_at' })
  scheduledAt!: Date;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'varchar', length: 64, name: 'failed_reason', nullable: true })
  failedReason!: string | null;
}
