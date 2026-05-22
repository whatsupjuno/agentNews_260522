# @agentnews/mobile

Expo SDK 51 + React Native + TypeScript + NativeWind + React Navigation v7.

## 위장 원칙

- 앱 이름 `DailyNews`, 번들 `com.dailynews.app` — `agent` / `chat` / `secret` 단어 0
- 스크린 네이밍: `ChatScreen` 금지. 채팅은 `ArticleDetailScreen` 내부 conditional swap (`src/screens/ArticleDetailScreen.tsx`)
- 알림: `expo-notifications` notification payload only, data payload 0
- 백그라운드 5초+ → unlock 자동 종료 (REQ-023)
- 앱 재시작 시 항상 NewsFeed부터 (REQ-024)

## 13 스크린

| ID | 파일 |
|---|---|
| SCR-001 | `src/screens/LoginScreen.tsx` |
| SCR-002 | `src/screens/RegisterScreen.tsx` |
| SCR-003 | `src/screens/SequenceResetScreen.tsx` |
| SCR-010 | `src/screens/NewsFeedScreen.tsx` |
| SCR-011 + SCR-020 | `src/screens/ArticleDetailScreen.tsx` (conditional swap) |
| SCR-021 | `src/screens/PairingSearchScreen.tsx` |
| SCR-022 | `src/screens/PairingRequestScreen.tsx` |
| SCR-030 ~ 034 | Settings/Profile/Sequence/PairDisconnect |

## 실행

```bash
# (루트에서 한 번) pnpm install
pnpm --filter @agentnews/mobile start
# i = iOS Simulator, a = Android Emulator

# EAS dev build 가 필요한 시점:
# - react-native-keychain 사용 (네이티브 모듈)
# - 푸시 알림 실기기 테스트
# Expo Go 만으로는 react-native-keychain 동작 안 함.
```

## 의존성 메모

- `react-native-keychain` 은 Expo Go 미지원 → EAS dev build 필요. 임시 대안으로 `expo-secure-store` 로 시작 가능
- `nativewind` v4: babel preset + metro plugin + global.css 입력 필요 (이미 설정됨)
- `expo-notifications`: iOS push 는 APNs key 필요. Android 는 FCM. 백엔드는 firebase-admin 단일 (FCM 이 APNs 자동 중계)

## 다음 작업

1. `pnpm install` 후 `pnpm mobile:dev` 로 부팅 확인
2. `src/services/api.ts` 작성 (백엔드 fetch wrapper, JWT 헤더)
3. `src/store/` 인증 / unlock 세션 상태 관리
4. `NewsFeedScreen` 의 시퀀스 탭 추적 로직 구현 (1초 rate limit, REQ-007)
