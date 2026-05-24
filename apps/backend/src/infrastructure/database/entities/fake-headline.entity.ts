import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('fake_headlines')
export class FakeHeadlineEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 160, unique: true })
  headline!: string;

  @Column({ type: 'varchar', length: 32, default: 'general' })
  category!: 'general' | 'politics' | 'economy' | 'tech' | 'culture';

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;
}
