import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const FAKE_HEADLINES: string[] = [
  'AI 모델 공개 — 안전성 논쟁 가열',
  '기후 정상회담, 25개국 탄소 감축 합의안에 서명',
  '한국은행, 기준금리 동결 결정… 시장 즉시 안도 랠리',
  '신형 전기차 배터리, 충전 8분에 주행거리 512km 검증',
  'K-드라마 신작, 28개국 OTT 시청률 동시 1위 달성',
  '도시 재생 프로젝트, 폐공장이 복합문화공간으로',
  '프로야구 개막전, 잠실 7만 1천명… 최다 관중 신기록',
  'AI 윤리 가이드라인, 국가 단위 표준화 논의 본격화',
  '국제 우주 정거장, 새 모듈 도킹 성공',
  '서울 청년 창업 지원금, 신청 접수 시작',
  '지하철 9호선 연장 구간 개통 임박',
  '국립박물관 특별전 관람객 100만 돌파',
];

const DEDUP_WINDOW_MS = 60_000;

/**
 * 위장 푸시 발송 — handoff §6 / REQ-021.
 * - title "📰 새 뉴스" + body 랜덤 가짜 헤드라인
 * - data payload 의도적 미사용 (notification only)
 * - per-pairing dedup: 같은 페어에 1분 이내 추가 푸시 skip
 *
 * Expo Push API 사용 → FCM/APNs 자격증명 불필요.
 */
@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly expo = new Expo();
  private readonly lastPushAt = new Map<string, number>();

  /**
   * 페어에 위장 푸시 발송 (수신자 토큰 N개에 fan-out).
   * 1분 이내 같은 페어에 발송된 적 있으면 skip.
   */
  async sendDisguisedToPair(
    pairingId: string,
    recipientTokens: string[],
  ): Promise<{ delivered: boolean; skipped?: 'dedup' | 'no-token' | 'invalid' }> {
    if (this.shouldDedup(pairingId)) {
      this.logger.log(`push dedup: pair=${pairingId} (1분 내 재발송 skip)`);
      return { delivered: false, skipped: 'dedup' };
    }
    const validTokens = recipientTokens.filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) {
      return { delivered: false, skipped: validTokens.length === 0 ? 'no-token' : 'invalid' };
    }

    const headline = this.pickHeadline();
    const messages: ExpoPushMessage[] = validTokens.map((to) => ({
      to,
      title: '📰 새 뉴스',
      body: headline,
      sound: 'default',
      // data 의도적 미사용 — 위장 §5 / SEC: notification only
    }));

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];
      for (const chunk of chunks) {
        const t = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...t);
      }
      this.lastPushAt.set(pairingId, Date.now());
      const okCount = tickets.filter((t) => t.status === 'ok').length;
      this.logger.log(
        `push sent: pair=${pairingId} headline="${headline}" tickets=${okCount}/${tickets.length}`,
      );
      return { delivered: okCount > 0 };
    } catch (e) {
      this.logger.error(`push failed: ${(e as Error).message}`);
      return { delivered: false };
    }
  }

  private shouldDedup(pairingId: string): boolean {
    const last = this.lastPushAt.get(pairingId);
    if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
    return false;
  }

  private pickHeadline(): string {
    return FAKE_HEADLINES[Math.floor(Math.random() * FAKE_HEADLINES.length)] ?? FAKE_HEADLINES[0]!;
  }
}
