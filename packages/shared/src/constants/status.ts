/**
 * 7개 상태축 × 21개 상태값 — docs/specs/spec/status_values_final.md / db_design §8.
 * varchar(32) + CHECK 제약과 1:1 매핑 (PostgreSQL ENUM 미사용 — 마이그레이션 용이성).
 */

export const AGENT_STATUSES = ['ACTIVE', 'DELETED'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const SEQUENCE_STATUSES = [
  'NOT_REGISTERED',
  'REGISTERED',
  'RESET_PENDING',
] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];

export const UNLOCK_SESSION_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type UnlockSessionStatus = (typeof UNLOCK_SESSION_STATUSES)[number];

export const UNLOCK_REVOKED_REASONS = [
  'BACKGROUND',
  'LOGOUT',
  'APP_RESTART',
  'PAIR_DISCONNECT',
  'NEW_UNLOCK',
] as const;
export type UnlockRevokedReason = (typeof UNLOCK_REVOKED_REASONS)[number];

export const PAIRING_STATUSES = [
  'PAIRING_REQUESTED',
  'PAIRED',
  'PAIRING_REJECTED',
  'DISCONNECTED',
] as const;
export type PairingStatus = (typeof PAIRING_STATUSES)[number];

export const MESSAGE_STATUSES = ['SENT', 'DELETED'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const ATTACHMENT_STATUSES = ['PENDING', 'AVAILABLE', 'DELETED'] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const NOTIFICATION_STATUSES = ['QUEUED', 'SENT', 'FAILED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
