import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('news_articles_cache')
export class NewsArticleCacheEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', name: 'batch_id', default: () => 'gen_random_uuid()' })
  batchId!: string;

  @Column({ type: 'smallint', name: 'display_order' })
  displayOrder!: number;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'varchar', length: 2048, name: 'thumbnail_url', nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  source!: string | null;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'fetched_at' })
  fetchedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
