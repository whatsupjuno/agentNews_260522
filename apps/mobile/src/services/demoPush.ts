import * as Notifications from 'expo-notifications';
import { FAKE_HEADLINE_FALLBACK_POOL } from '@agentnews/shared';

// 위장 푸시 — handoff §6 / REQ-021
// - title "📰 새 뉴스" (data payload 0 — notification only)
// - body 랜덤 헤드라인

let permissionInitialized = false;

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return req.status === 'granted';
}

export async function initDemoPush(): Promise<void> {
  if (permissionInitialized) return;
  permissionInitialized = true;
  // 앱이 foreground 일 때도 배너 표시 (테스트 편의)
  await Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * 5초 뒤 가짜 위장 푸시 1개 schedule.
 * 사용자가 홈 버튼으로 백그라운드 가면 잠금화면/배너로 노출.
 *
 * data payload 의도적으로 미사용 (위장 강화).
 */
export async function scheduleDisguisedDemoPush(): Promise<{ delivered: boolean; body: string }> {
  await initDemoPush();
  const ok = await ensurePermission();
  if (!ok) {
    return { delivered: false, body: '알림 권한이 거부됨' };
  }
  const headline =
    FAKE_HEADLINE_FALLBACK_POOL[Math.floor(Math.random() * FAKE_HEADLINE_FALLBACK_POOL.length)] ??
    'AI 모델 공개 — 안전성 논쟁 가열';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📰 새 뉴스',
      body: headline,
      sound: 'default',
      // data: {} 사용 X (위장 §5 / SEC: notification only)
    },
    trigger: { seconds: 5, channelId: 'default' } as Notifications.TimeIntervalTriggerInput,
  });
  return { delivered: true, body: headline };
}
