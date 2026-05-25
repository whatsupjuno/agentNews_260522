import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from './api';

let handlerInitialized = false;
let registeredFor: string | null = null;

/**
 * Notification handler — foreground 에서도 배너 표시.
 * 앱 부팅 시 한 번만 호출.
 */
export function initNotificationHandler(): void {
  if (handlerInitialized) return;
  handlerInitialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Expo Push Token 발급 + 백엔드 등록.
 * register / login 후 한 번씩 호출. 같은 accessToken 으로는 한 번만.
 */
export async function registerPushTokenWithBackend(accessToken: string): Promise<void> {
  if (registeredFor === accessToken) return;
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    final = req.status;
  }
  if (final !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  const projectId =
    (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
      ?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) return;
    await apiFetch('/me/push-token', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      accessToken,
    });
    registeredFor = accessToken;
  } catch {
    // silent — 푸시 등록 실패가 로그인 흐름 차단하지 않음
  }
}

/** 로그아웃 시 cache 비우기 (다음 로그인 때 다시 등록되도록) */
export function resetPushRegistrationCache(): void {
  registeredFor = null;
}
