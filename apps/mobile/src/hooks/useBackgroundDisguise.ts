import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

/**
 * App Switcher 위장 — handoff §6 PushNotifications + §5 위장 강화.
 *
 * - Android: FLAG_SECURE 활성 (스크린샷 + 최근 앱 미리보기 차단)
 * - iOS: AppState 'inactive' / 'background' 진입 시 본 hook 사용처가
 *   blur overlay (또는 dummy news feed) 를 띄움.
 *
 * 반환 `shouldDisguise` 가 true 일 때 ChatBody 위에 blur 또는 가짜 피드 overlay.
 */
export function useBackgroundDisguise(active: boolean): { shouldDisguise: boolean } {
  const [shouldDisguise, setShouldDisguise] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'android') {
      void ScreenCapture.preventScreenCaptureAsync();
    }
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'inactive' || next === 'background') {
        setShouldDisguise(true);
      } else if (next === 'active') {
        setShouldDisguise(false);
      }
    });
    return () => {
      sub.remove();
      if (Platform.OS === 'android') {
        void ScreenCapture.allowScreenCaptureAsync();
      }
    };
  }, [active]);

  return { shouldDisguise };
}
