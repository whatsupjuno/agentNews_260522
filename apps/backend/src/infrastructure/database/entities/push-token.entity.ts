import { Column, Entity } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('push_tokens')
export class PushTokenEntity extends SoftDeletableEntity {
  @Column({ type: 'bigint', name: 'agent_id' })
  agentId!: string;

  @Column({ type: 'varchar', length: 512, name: 'fcm_token' })
  fcmToken!: string;

  @Column({ type: 'varchar', length: 16 })
  platform!: 'ios' | 'android';

  @Column({ type: 'timestamptz', name: 'last_seen_at' })
  lastSeenAt!: Date;
}
