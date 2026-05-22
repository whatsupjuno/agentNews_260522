import type { AttachmentStatus } from '../constants/status';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export interface AttachmentMeta {
  externalId: string;
  status: AttachmentStatus;
  mimeType: AllowedMimeType;
  fileSizeBytes: number;
  originalFilename?: string;
  uploadedAt?: string;
}

export interface PresignedDownloadUrl {
  url: string;
  expiresAt: string;
}
