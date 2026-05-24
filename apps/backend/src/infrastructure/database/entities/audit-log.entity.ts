import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 48 })
  kind!: string;

  @Column({ type: 'bigint', name: 'actor_agent_id', nullable: true })
  actorAgentId!: string | null;

  @Column({ type: 'varchar', length: 16, name: 'actor_kind', default: 'agent' })
  actorKind!: 'agent' | 'system' | 'external';

  @Column({ type: 'varchar', length: 32, name: 'target_type', nullable: true })
  targetType!: string | null;

  @Column({ type: 'bigint', name: 'target_id', nullable: true })
  targetId!: string | null;

  @Column({ type: 'uuid', name: 'target_external_id', nullable: true })
  targetExternalId!: string | null;

  @Column({ type: 'inet', name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
