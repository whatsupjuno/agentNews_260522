/** 위장 푸시 — REQ-021. data payload 미사용 (notification 만) */
export type NotificationTriggerKind =
  | 'MESSAGE_TEXT'
  | 'MESSAGE_IMAGE'
  | 'MESSAGE_FILE'
  | 'PAIRING_REQUEST'
  | 'PAIRING_REJECT';

export interface FakeHeadline {
  id: number;
  headline: string;
  category: 'general' | 'politics' | 'economy' | 'tech' | 'culture';
}
