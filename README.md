# agentNews

> 위장 뉴스앱 + 비밀 1:1 채팅 SaaS. 뉴스 피드의 1·3·5·7번 기사를 `5 → 3 → 1 → 7` 순으로 탭하면 채팅 모드로 전환. 친구 6명 (3 페어) 대상의 비공개 서비스.

원본 spec: PLAN-003 산출물 22개 (`docs/specs/`). 컨텍스트 / 디자인 brief: `docs/origin/`.

---

## 구조 (monorepo)

```
agentNews/
├─ apps/
│  ├─ backend/        # NestJS 10 + TypeScript + TypeORM (Clean Architecture 4계층)
│  └─ mobile/         # Expo SDK 51 + RN + TypeScript + NativeWind + React Navigation v7
├─ packages/
│  └─ shared/         # 백엔드/모바일 공유 타입·상수·에러 코드
├─ infra/
│  ├─ docker-compose.yml  # PostgreSQL 16 + MinIO
│  └─ postgres/init/      # ddl.sql 자동 적재
├─ docs/
│  ├─ origin/         # 컨텍스트 + 디자인 brief (사용자 원본)
│  └─ specs/          # PLAN-003 산출물 (요구사항, API, DB, 화면, 시나리오 등)
├─ package.json       # pnpm workspace 루트
├─ tsconfig.base.json
├─ .env.example
└─ .gitignore
```

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 모바일 | React Native + **Expo (managed)** + TypeScript + NativeWind + React Navigation v7 |
| 모바일 푸시 | `expo-notifications` (APNs + FCM) |
| 모바일 파일 picker | `expo-document-picker` + `expo-image-picker` |
| 모바일 토큰 저장 | `react-native-keychain` (EAS dev build 필요. Expo Go 미지원) |
| 백엔드 | NestJS 10+ + TypeScript + REST + WebSocket (Socket.IO) |
| 백엔드 ORM | TypeORM Repository 패턴 (raw query 금지) |
| 백엔드 암호 | bcrypt cost 12 / AES-256-GCM / HMAC-SHA256 |
| 백엔드 푸시 | `firebase-admin` |
| DB | PostgreSQL 16 + `pgcrypto` extension |
| 첨부 저장소 | MinIO (S3 호환) — `@aws-sdk/client-s3` |
| 외부 뉴스 API | GNews / MediaStack / NewsAPI.org 중 무료 tier 선정 |
| 컨테이너 | Docker + docker-compose |
| 배포 | iOS TestFlight, Android Firebase App Distribution |

> **컨벤션 충돌 메모**: `docs/specs/spec/development_conventions.md` 는 RN bare + `@react-native-firebase/messaging` + `react-native-image-picker` 등 RN bare workflow 기준이지만, `docs/origin/agentNews-context.md` 가 Expo (managed) + `expo-*` 패키지로 최종 확정 (우선순위: Juno 지시 > brief > 매뉴얼). 본 repo 는 **Expo managed 채택**.

---

## 핵심 위장 원칙 (요약)

1. **위장 응답**: 비밀 도메인 (`/unlock`, `/pairings`, `/messages`, `/attachments`, WS `/ws`) 의 모든 권한 거부 → `404 NEWS_ARTICLE_NOT_FOUND` 단일 형태. 외부에서 일반 뉴스 API 응답과 구분 불가
2. **위장 라우트**: 채팅 화면은 `ArticleDetailScreen` 내부 conditional swap. 별도 ChatScreen 명명 금지
3. **위장 알림**: FCM `notification` payload 만 (`data` 0). 제목 `📰 새 뉴스 — <헤드라인>`
4. **위장 복귀**: 백그라운드 5초+ 시 unlock 자동 종료. 앱 재시작 시 항상 뉴스 피드부터
5. **첨부 검증**: MIME allow-list 4종 + 매직바이트 검증
6. **시퀀스 저장**: HMAC-SHA256 + 16B salt. 평문/가역 형태 저장 금지

---

## 빠른 시작

```bash
# 1. 의존성
nvm use            # 20.19.3
pnpm install

# 2. 환경 변수
cp .env.example .env
# .env 편집 (MESSAGE_ENC_KEY 등 dev placeholder 교체)

# 3. 인프라 (PostgreSQL + MinIO)
pnpm infra:up
# postgres: localhost:5432  /  minio: localhost:9000 (콘솔 9001)

# 4. 백엔드
pnpm backend:dev

# 5. 모바일 (별도 터미널)
pnpm mobile:dev
```

---

## 13 화면 (모바일)

| ID | RN Screen | 권한 |
|---|---|---|
| SCR-001 | `LoginScreen` | 미인증 |
| SCR-002 | `RegisterScreen` | 미인증 |
| SCR-003 | `SequenceResetScreen` | 딥링크 |
| SCR-010 | `NewsFeedScreen` | agent |
| SCR-011 / 020 | `ArticleDetailScreen` (+ chat swap) | agent (+ unlock + PAIRED) |
| SCR-021 | `PairingSearchScreen` | agent + unlock |
| SCR-022 | `PairingRequestScreen` | agent + unlock |
| SCR-030 | `SettingsScreen` | agent |
| SCR-031 | `ProfileEditScreen` | agent |
| SCR-032 | `SequenceChangeScreen` | agent |
| SCR-033 | `SequenceResetRequestScreen` | agent |
| SCR-034 | `PairDisconnectScreen` | agent (PAIRED) |

---

## 백엔드 도메인 (10 API)

`auth`, `user_management`, `news`, `secret_unlock`, `pairing`, `chat`, `message`, `attachment`, `notification`, `audit_log`.

각 spec: `docs/specs/api/*.md`.

---

## 다음 작업

1. `pnpm install` 로 의존성 다운로드
2. `pnpm infra:up` 으로 PostgreSQL + MinIO 부팅 → ddl.sql 자동 적재 확인
3. 백엔드 `auth` 도메인부터 차례로 구현 (REQ-001 ~ REQ-003)
4. 모바일은 `LoginScreen` 부터

---

작성: PLAN-003 (Humanless Planning System v0.2) 산출물 기반. 본 repo 는 spec-driven 구현 단계.
