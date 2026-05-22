import type { MessageStatus } from '../constants/status';

/**
 * 클라이언트에 노출되는 메시지. body 는 백엔드에서 복호화 후 응답 (서버측 AES-256-GCM,
 * E2E 는 v1 범위 외 — REQ-016 / SEC-002).
 */
export interface Message {
  externalId: string;
  pairingExternalId: string;
  senderExternalId: string;
  body: string;
  hasAttachment: boolean;
  attachment?: {
    externalId: string;
    mimeType: string;
    fileSizeBytes: number;
    originalFilename?: string;
  };
  status: MessageStatus;
  sentAt: string;
}

export interface SendMessageRequest {
  body: string;
  attachmentExternalId?: string;
}
