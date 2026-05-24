import { Column, Entity } from 'typeorm';
import { SoftDeletableEntity } from './base.entity';

@Entity('message_attachments')
export class MessageAttachmentEntity extends SoftDeletableEntity {
  @Column({ type: 'uuid', name: 'external_id', unique: true })
  externalId!: string;

  @Column({ type: 'bigint', name: 'message_id', nullable: true })
  messageId!: string | null;

  @Column({ type: 'bigint', name: 'uploader_agent_id' })
  uploaderAgentId!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: 'PENDING' | 'AVAILABLE' | 'DELETED';

  @Column({ type: 'varchar', length: 255, name: 'storage_key', unique: true })
  storageKey!: string;

  @Column({ type: 'varchar', length: 64, name: 'mime_type' })
  mimeType!: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

  @Column({ type: 'bigint', name: 'file_size_bytes' })
  fileSizeBytes!: string;

  @Column({ type: 'varchar', length: 255, name: 'original_filename', nullable: true })
  originalFilename!: string | null;

  @Column({ type: 'boolean', name: 'magic_byte_verified', default: false })
  magicByteVerified!: boolean;

  @Column({ type: 'timestamptz', name: 'uploaded_at', nullable: true })
  uploadedAt!: Date | null;
}
