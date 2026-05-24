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

## 의존성 메모 (Phase 1 — Expo managed)

전부 Expo Go 만으로 동작. dev build / native 컴파일 불필요.

- **`expo-secure-store`** — iOS Keychain + Android Keystore 래핑. JWT 토큰 저장
- **`expo-notifications`** — FCM/APNs 통합 푸시. 백엔드는 firebase-admin 단일 (FCM 이 iOS APNs 자동 중계)
- **`expo-image-picker`** / **`expo-document-picker`** — 첨부 picker
- **`expo-screen-capture`** — Android FLAG_SECURE 자동. 채팅 모드 진입 시 prevent → 종료 시 allow
- **`expo-blur`** — iOS 백그라운드 진입 시 채팅 화면 위에 blur view 덮기 (App Switcher 위장)
- **NativeWind v4** — babel preset + metro plugin + `global.css` 입력 이미 설정됨

## Phase 2 (Post-MVP) — RN bare 마이그레이션

native 미세 제어 필요 시점에 `npx expo prebuild` 로 전환. 다음 패키지 교체 검토:
- `expo-secure-store` → `react-native-keychain`
- `expo-notifications` → `@react-native-firebase/messaging`
- `expo-image-picker` → `react-native-image-picker`
- `expo-screen-capture` → 직접 `WindowManager.LayoutParams.FLAG_SECURE` 호출

## 다음 작업

1. `pnpm install` 후 `pnpm mobile:dev` 로 부팅 확인 (Expo Go 앱으로 QR 스캔)
2. `src/services/api.ts` 작성 (백엔드 fetch wrapper, JWT 헤더)
3. `src/store/` 인증 / unlock 세션 상태 관리
4. `NewsFeedScreen` 의 워드마크 ARM + 시퀀스 트래커 훅 (M2-5, **`showToast` 금지**)
