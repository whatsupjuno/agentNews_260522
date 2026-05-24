import { Column, Entity, Index } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('agents')
export class AgentEntity extends SoftDeletableEntity {
  @Column({ type: 'uuid', name: 'external_id', unique: true })
  externalId!: string;

  @Index('idx_agents_email_unique', { unique: true, where: 'deleted_at IS NULL' })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 72, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 40 })
  nickname!: string;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DELETED';
}
