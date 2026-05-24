# agentNews / DailyNews — 통합 개발 계획서 v1

> 작성: 2026-05-24 / 베이스: PLAN-003 산출물 (스펙 22개) + Design Handoff (storyboard + 5 화면 + jsx reference)
> 단위: 마일스톤 7개 × 작업 카드 ~32개. Agent 8 역할로 분담.

---

## §0. 한 번에 보기

| 항목 | 값 |
|---|---|
| 코드네임 | **agentNews** (내부) / **DailyNews** (외부 노출) |
| MVP 범위 | **5 플로우** — 위장 진입 / 위장 알림 / 첨부 전송 / 회원가입 / 프로필+데이터 삭제 |
| MVP 화면 | **5** — Login / Register / NewsFeed / ArticleDetail (chat swap) / Settings + ProfileEdit |
| Deferred (v1.5+) | 페어링 UI · 시퀀스 변경 UI · 시퀀스 reset · 페어 해제 (모두 DB 직접 관리로 우회) |
| 시퀀스 진입 | **워드마크 탭 → ARM 8초 → 카드 5→3→1→7** (PLAN-003 의 단순 탭 대비 ARM 단계 추가) |
| 시퀀스 | **공통 상수 `[5, 3, 1, 7]`** (PLAN-003 의 페어별 개인화 deferred) |
| unlock_token TTL | **60분** (PLAN-003 의 30분에서 상향) |
| Tech 결정 | RN bare workflow 권장 (Design Handoff) vs Expo managed (context.md) — **§2-B 에서 결정 필요** |

---

## §1. 자료 종합 — 무엇이 변했나

세 자료가 동시에 살아있다.

| 자료 | 위치 | 역할 |
|---|---|---|
| PLAN-003 산출물 | `docs/specs/` | **백엔드 스펙의 ground truth** — DDL 14 테이블, API 10 도메인, REQ-001~025, 보안 정책, 상태 전이 |
| Design Handoff v2 | `docs/design/` | **모바일 UI/UX 의 ground truth** — 9 HTML 모킹 (Login/Register/NewsFeed/ArticleDetail/Settings/ProfileEdit+DataDelete모달/Push/Components/index), ARM 신호 0 위장 강화 |
| 사용자 컨텍스트 | `docs/origin/` | **결정의 1순위** — Juno 확정 스택, 페어링 모델, MIME 5종, 캐시 TTL |

**우선순위**: Design Handoff(MVP 범위/UX) > 사용자 컨텍스트(스택) > PLAN-003(상세 스펙). 충돌 시 §2 reconciliation 표 참조.

---

## §2. Reconciliation — 자료 간 충돌 14개

### A. MVP 범위 (해결됨)

| 항목 | PLAN-003 | Design Handoff | 채택 |
|---|---|---|---|
| 화면 수 | 13 | 5 | **5** (handoff) — 나머지 8 화면 stub 은 유지하되 라우터에서 제거 |
| 페어링 UI | 검색 + 요청 + 수락/거부 + 해제 | **없음 (DB 직접)** | **없음** |
| 시퀀스 변경 UI | 있음 (SCR-032) | 없음 | **없음 (DB 직접)** |
| 시퀀스 reset 메일 | REQ-008 | 없음 | **없음** (deferred) |
| 시퀀스 개인화 | 페어별 4~6자리 | **공통 `[5,3,1,7]`** | **공통** |

### B. 기술 스택 (확정 — Phase 1 Expo managed → Phase 2 RN bare)

| 항목 | Phase 1 (M0~M5) | Phase 2 (Post-MVP) |
|---|---|---|
| RN 워크플로우 | **Expo SDK 51 managed (Expo Go)** | **RN bare workflow** (마이그레이션) |
| 토큰 저장 | `expo-secure-store` (Keychain/Keystore 래핑) | `react-native-keychain` (선택적) |
| 푸시 SDK | `expo-notifications` (FCM/APNs 통합) | `@react-native-firebase/messaging` |
| 파일 picker | `expo-image-picker` + `expo-document-picker` | `react-native-image-picker` + `react-native-document-picker` |
| iOS 백그라운드 blur | `expo-blur` + AppState listener | UIApplication delegate 직접 |
| Android FLAG_SECURE | `expo-screen-capture` | `WindowManager.LayoutParams.FLAG_SECURE` 직접 |

> **전환 전략**: Phase 1 은 Expo Go 로 빠르게 6명 베타 검증. Phase 2 는 native 모듈 미세 제어가 필요할 때 (예: App Switcher swap 의 정확한 타이밍 / 백그라운드 캡처 차단 강화 / FCM 고도화) `npx expo prebuild` 로 RN bare 전환. Expo SDK 51 의 Continuous Native Generation 덕분에 마이그레이션 부담 낮음.

### C. unlock_token / TTL (해결됨)

| 항목 | PLAN-003 | Design Handoff | 채택 |
|---|---|---|---|
| unlock_token TTL | 30분 | **60분** | **60분** |
| 백그라운드 disarm | 5초 | 5초 (변동 없음) | **5초** |
| ARM 모드 | 없음 | **8초 타이머** | **8초 ARM 추가** |
| ARM 진입 trigger | 없음 (직접 카드 탭) | **워드마크 탭** | **워드마크 탭** |
| ARM 진입/auto-disarm 시각 피드백 | — | **신호 0** (handoff v2 갱신) | **신호 0** — 토스트/애니/소리/진동 전부 금지 |
| 카드 오탭 reset 시각 피드백 | — | **신호 0** | **신호 0** |
| 유일한 외부 신호 | — | 시퀀스 완성 시 `ArticleDetailScreen` 자연스러운 이동 (그 화면이 chat mode 로 swap 되어 있는 것) | 동일 |

### D. 위장 어휘 (해결됨)

Design Handoff §5 의 외부/내부 분리 정책 채택.

| 외부 노출 | 내부 코드 (변경 없음) |
|---|---|
| "구독자" | `pair` / `pairing` (DB) |
| "기사 토론" | `chat` / `discussion` (내부 enum) |
| "콘텐츠 잠금 코드" | `secret_sequence` (DB) |
| "댓글" | `message` (DB) |
| "댓글 입력" | input placeholder |

> 즉 **DB 스키마와 internal class 명은 PLAN-003 그대로 유지**. UI 노출 string / push title / placeholder 만 위장 어휘로 매핑. shared 패키지의 영어 타입명 (Pairing, Message) 은 변경 불필요.

### E. API 형상 (해결 필요 — §3 작업 카드)

PLAN-003 의 10 도메인 중 MVP 에서 active 는 6 개. 나머지 4 는 internal-only.

| 도메인 | MVP 노출? | 비고 |
|---|---|---|
| auth | ✅ | REQ-001~003 |
| user_management (me) | ✅ | profile 수정 + 데이터 삭제 |
| news | ✅ | feed + article detail |
| secret_unlock | ✅ | `POST /sequence/verify` 단일 endpoint |
| chat / message | ✅ | `/articles/:id/comments` 어휘 위장 + WebSocket |
| attachment | ✅ | multipart + presigned URL |
| pairing | ❌ (deferred) | DB 직접 관리. read-only `GET /me/subscriber` 만 |
| notification | ❌ (internal) | 백엔드 worker queue 만 |
| audit_log | ❌ (internal) | 운영 직접 조회 |
| sequence reset | ❌ (deferred) | — |

URL **외부 표기는 어휘 위장** — `/api/v1/articles/:id/comments` (내부 messages), `/api/v1/me/subscriber` (내부 pairing). 단 URL은 RN 에서 외부 노출 0 (URL bar 없음) → **위장 우선순위 낮음, 내부 명시성 우선**.

> **결정**: URL은 PLAN-003 형식 (`/api/v1/messages`, `/api/v1/pairings`) 유지. 디자인 handoff §10 의 `/chat/...`, `/articles/:id/comments` 는 reference 만. 어차피 RN 에서 외부 노출 0.

---

## §3. 마일스톤 7개

각 마일스톤은 끝났을 때 데모 가능한 상태를 만든다.

### M0 — 정합 + 부트 (Day 0~1)

- [M0-1] `pnpm install` + `pnpm infra:up` 부팅 검증, 백엔드 `/health` 200 응답 확인 — **infra-platform**
- [M0-2] 기술 스택 충돌 §2-B 사용자 확정 → 모바일 `package.json` 갱신 (Expo dev-client 채택 시 `expo-dev-client` 추가, `@react-native-firebase/*` 추가) — **product-orchestrator**
- [M0-3] 위장 어휘 매핑 상수를 `packages/shared/src/constants/disguise.ts` 에 추가 (외부 라벨 ↔ 내부 enum) — **mobile-feature-dev**
- [M0-4] Design Handoff §6 의 디자인 토큰을 `apps/mobile/tailwind.config.js` 에 반영 (현재 일부만 매핑됨 — 누락: `displayXxl`, `red`, `purple`, `bubbleMeFg`, separator 등) — **design-fidelity**
- [M0-5] `git push -u origin main` 사용자 컨펌 후 — **product-orchestrator**

게이트: 백엔드 부팅 + 모바일 Metro 부팅 + Tailwind 토큰 적용 확인.

### M1 — Auth (Day 1~3)

- [M1-1] TypeORM entity 14개 작성 (`agents` ~ `idempotency_keys`) — **backend-domain-dev**
- [M1-2] auth UseCase: register / login / refresh / logout — bcrypt cost 12 / JWT access 15분 + refresh 30일 + unlock 60분 — **backend-domain-dev**
- [M1-3] DisguiseExceptionFilter 통과 테스트 + IdempotencyGuard — **backend-domain-dev**
- [M1-4] `LoginScreen` / `RegisterScreen` 디자인 fidelity 구현 — Design Handoff §8.1 / §8.2 — **mobile-feature-dev**
- [M1-5] 토큰 저장 (`react-native-keychain` or EAS dev build 결정 후) — **mobile-feature-dev**
- [M1-6] 회원가입 → 자동 로그인 → NewsFeed `replace` 네비게이션 (handoff §8.2) — **mobile-feature-dev**

게이트: 로그인 후 access token 발급 + 모바일 keychain 저장 + 새로 시작해도 자동 로그인.

### M2 — News Feed + 위장 진입 (Day 3~6) ★ 가장 중요

- [M2-1] 뉴스 API 클라이언트 — 후보 GNews/MediaStack/NewsAPI 중 1개 선정 → 캐시 10분 — **backend-domain-dev**
- [M2-2] `GET /api/v1/news/feed` → `display_order` (1~N) 부여하여 응답 — **backend-domain-dev**
- [M2-3] `POST /api/v1/sequence/verify` `{ sequence: [5,3,1,7] }` → HMAC-SHA256 비교 → unlock_token (60분) 발급 — **backend-domain-dev**
- [M2-4] `NewsFeedScreen` 픽셀 fidelity — Hero card + 6 thumb cards + category strip + tab bar + pull-to-refresh — **mobile-feature-dev**
- [M2-5] **워드마크 ARM + 시퀀스 트래커 훅** `useFeedSequence()` — handoff §8.3 의 JS 로직을 TS+RN 으로. **`showToast` 호출 금지** (handoff v2 위장 원칙) — **mobile-feature-dev**
- [M2-6] 시퀀스 완성 시 `sequence/verify` 호출 → `ArticleDetail` (mode=chat) navigate. 그 navigate 자체가 유일한 외부 신호 — **mobile-feature-dev**
- [M2-7] **시각적 위장 검수** — 워드마크 탭 외관 변화 0, 카드 오탭 reset 피드백 0, auto-disarm 8초 silent (handoff §12 신규 3개 체크리스트) — **disguise-auditor**

게이트: 워드마크 탭 → ARM 토스트만 표시 → 카드 5/3/1/7 탭 → 채팅 모드 진입. 잘못 탭 시 reset (단 #5 면 progress=1).

### M3 — ArticleDetail (Normal + Chat swap) (Day 6~9)

- [M3-1] `articles` 도메인: 캐시된 기사 본문 `GET /api/v1/articles/:id` — **backend-domain-dev**
- [M3-2] 메시지 도메인: `GET /api/v1/messages?pairing_id=...` (어휘 위장 url 옵션은 deferred) + AES-256-GCM 본문 암복호화 — **backend-domain-dev**
- [M3-3] WebSocket Gateway — `/ws` handshake → 자동 `pairing:<id>` 채널 join, 클라이언트 join 이벤트 거부 (SEC-005) — **backend-domain-dev**
- [M3-4] `POST /api/v1/messages` (Idempotency-Key 필수) + 위장 notification queue insert — **backend-domain-dev**
- [M3-5] `ArticleDetailScreen` — header chrome 공통 + normal mode body (drop-cap, 원문 보기) — **mobile-feature-dev**
- [M3-6] Chat mode body — pinned context card + day separator + bubble grouping + corner pinch + 입력바 (placeholder "댓글 입력") — **mobile-feature-dev**
- [M3-7] `useChat(roomId)` 훅 — WebSocket subscribe + optimistic UI + 60분 unlock 만료 감지 → 자동 NewsFeed 복귀 — **mobile-feature-dev**

게이트: 메시지 전송 → 페어 기기에서 즉시 수신 (WebSocket) + bubble grouping 1분 규칙.

### M4 — 첨부 + 위장 푸시 (Day 9~12)

- [M4-1] MinIO `agentnews-attachments` 버킷 + 매직바이트 검증 (image/jpeg, image/png, image/webp, application/pdf — 4종 / handoff §5 의 5종 중 image/heic 제외, 매직바이트 검증 어려움) — **infra-platform** + **backend-domain-dev**
- [M4-2] `POST /api/v1/attachments` multipart → status=UPLOADING → AVAILABLE 흐름 + presigned URL 30분 — **backend-domain-dev**
- [M4-3] FCM 위장 푸시 worker — `notification_queue` 폴링 → 0~60초 jitter → `firebase-admin.send()` (notification only, data 0) — **backend-domain-dev**
- [M4-4] `fake_headlines` 시드 — 한국어 50개 (handoff 는 10-20개 요구, 안전 폭 50개) — **product-orchestrator**
- [M4-5] 모바일 첨부 picker (image / document) + 압축 미리보기 chip + 업로드 % — **mobile-feature-dev**
- [M4-6] App Switcher 위장 — iOS background blur + Android `FLAG_SECURE` 채팅 모드 토글 — **mobile-feature-dev**
- [M4-7] notification handler — cold/warm start 모두 NewsFeed 진입, **chat 자동 진입 금지** — **mobile-feature-dev**

게이트: 사진 1장 + PDF 1장 전송 → 페어 기기 위장 푸시 → tap → NewsFeed (chat 자동 진입 안 됨).

### M5 — Settings + 데이터 삭제 (Day 12~14)

- [M5-1] `SettingsScreen` — iOS grouped list, profile card, 4 group (계정 / 앱 / 로그아웃) — **mobile-feature-dev**
- [M5-2] `ProfileEditScreen` — 닉네임/상태메시지 편집 + `PATCH /api/v1/me` — **mobile-feature-dev**
- [M5-3] 데이터 삭제 확인 모달 — full-screen, 빨간 헤더, "삭제" 입력 검증 — **mobile-feature-dev**
- [M5-4] `DELETE /api/v1/me` — agents.status=DELETED (soft) + 페어 cascade (메시지 90일 정책 무시, 즉시 삭제) + MinIO worker — **backend-domain-dev**
- [M5-5] 응답 받으면 keychain clear + RN navigation `reset` LoginScreen — **mobile-feature-dev**

게이트: 데이터 삭제 → 재로그인 시도 시 `AUTH_INVALID_CREDENTIALS`.

### M6 — 위장 검수 + 테스트 + 배포 준비 (Day 14~17)

- [M6-1] 위장 검수 자동 grep — RN 빌드 산출물에서 `chat / secret / agent / 채팅 / 비밀 / 메시지` 0회 확인 (script: `tools/disguise-grep.sh`) — **disguise-auditor**
- [M6-2] handoff §12 체크리스트 12개 자동 테스트 (Detox 또는 manual checklist) — **qa-test-author**
- [M6-3] 5 플로우 E2E — backend supertest + 모바일 manual (또는 Maestro) — **qa-test-author**
- [M6-4] 보안 점검: AES-GCM key rotation 가능성, bcrypt cost, audit_logs UPDATE/DELETE 트리거 작동, IDOR (external_id 만 외부 노출), 매직바이트 — **security-reviewer**
- [M6-5] 배포 — **Cafe24 Docker 호스팅** (백엔드 docker-compose 그대로 이식 + 도메인/SSL 셋업) + **Android Firebase App Distribution** (Apple Developer Program 결제 후 TestFlight 는 별도 마일스톤) — **infra-platform**
- [M6-6] 디자인 fidelity 픽셀 비교 — HTML mockup vs 실기기 스크린샷, 5 화면 — **design-fidelity**

게이트: TestFlight 빌드 1 + Android APK 1 + 위장 grep PASS + handoff §12 12/12 PASS.

---

## §4. Agent 분담 (8 역할)

작업의 성격에 따라 8개 implementation agent 역할을 정의. Claude Code 의 `Agent` tool 로 sub-agent invoke 시, 아래 역할 정의를 prompt 로 넘김.

| # | Agent | 모델 | 책임 영역 | 활성 마일스톤 |
|---|---|---|---|---|
| 1 | **product-orchestrator** | Opus | 전체 진행 조율, decision log 관리, 충돌 reconciliation, 사용자 컨펌 게이트, push/PR 승인 요청 | M0~M6 (상시) |
| 2 | **backend-domain-dev** | Opus | NestJS 도메인 모듈 — UseCase / Entity / Repository / Controller. AES-GCM, HMAC, JWT, WebSocket, FCM 어댑터 | M1~M5 |
| 3 | **mobile-feature-dev** | Opus | RN 5 화면 + 시퀀스 트래커 훅 + WebSocket client + 첨부 picker + native module 통합 + App Switcher 위장 | M0, M1~M6 |
| 4 | **infra-platform** | Sonnet | docker-compose 검증, MinIO 버킷 + 정책, ddl.sql 적재, EAS dev build, TestFlight, Firebase App Distribution | M0, M4, M6 |
| 5 | **disguise-auditor** | Opus | 위장 검수 — 금지 단어 grep, 푸시 payload 검증, ARM 시각 피드백 0, App Switcher swap, FLAG_SECURE, 워드마크 cosmetic 변화 0 | M2, M4, M6 |
| 6 | **security-reviewer** | Opus | bcrypt / AES-GCM key 관리 / HMAC salt / IDOR external_id / 매직바이트 / audit_logs 불변성 / Idempotency-Key | M1, M4, M5, M6 |
| 7 | **qa-test-author** | Sonnet | handoff §12 체크리스트 자동화, 5 플로우 E2E (supertest + Maestro/Detox), 시퀀스 트래커 단위 테스트 | M2~M6 |
| 8 | **design-fidelity** | Sonnet | Tailwind 토큰 일치 (§6 핸드오프 vs `tailwind.config.js`), HTML mockup vs 실기기 픽셀 비교, 5 화면 cross-check | M0, M2, M3, M5, M6 |

### 협업 패턴

- **M0 정합 단계**: orchestrator 가 §2-B 결정을 사용자에게 컨펌 받음. 그 후 mobile/infra/design 이 병렬로 토큰·스택 셋업.
- **M1~M5 구현**: backend / mobile 이 같은 마일스톤을 병렬 진행. backend 가 endpoint mock 먼저 → mobile 이 그걸로 진행 → backend 가 실 구현 채워나감.
- **M2/M4/M6 검수**: disguise-auditor + security-reviewer 가 코드 PR 리뷰. 발견 시 backend/mobile 에 back-pressure.
- **M6 통합 게이트**: qa + design-fidelity + disguise + security 가 모두 PASS 줘야 배포.

### 병렬 invoke 예시

```
M2 동시 진행:
  ├─ backend-domain-dev: news feed API + sequence/verify endpoint
  ├─ mobile-feature-dev: NewsFeedScreen 픽셀 fidelity + useFeedSequence 훅
  └─ design-fidelity: Tailwind 토큰 vs §6 차이 audit

M2 게이트:
  └─ disguise-auditor: ARM/탭 시 외관 변화 0 확인
```

---

## §5. Decision Log (살아있는 상태)

| ID | 결정 | 사유 | 출처 |
|---|---|---|---|
| D-001 | MVP = 5 플로우 / 5 화면 | Design Handoff 우선, 페어링/시퀀스 변경/reset 은 DB 직접 관리 | Handoff §7 |
| D-002 | 시퀀스 = 공통 `[5,3,1,7]` | MVP 단순화, 사용자별 커스터마이즈 v1.5+ | Handoff §7 |
| D-003 | unlock_token TTL = 60분 | Handoff 우선 (PLAN-003 의 30분 갱신) | Handoff §8.4 |
| D-004 | ARM 모드 8초 추가 | 워드마크 탭 → ARM → 카드 시퀀스. 위장 강화 | Handoff §8.3 |
| D-005 | 위장 어휘 매핑 정책 | 외부 UI 문자열만 위장 (구독자/기사 토론/잠금 코드/댓글). DB/내부 코드 PLAN-003 명명 유지 | Handoff §5 |
| D-006 | URL = PLAN-003 형식 유지 | RN 에 URL bar 없어 외부 노출 0. 내부 명시성 우선 | 이 문서 §2-E |
| D-007 | MIME 4종 (jpeg/png/webp/pdf) | image/heic 매직바이트 검증 어려움, PLAN-003 도 4종 (handoff 의 5종 중) | dev_conventions §7-11 |
| D-008 | **워크플로우 = Phase 1 Expo managed → Phase 2 RN bare** | 일단 Expo Go 로 6명 베타 빠르게 검증, native 미세제어 필요 시점에 `expo prebuild` 로 전환 | 사용자 결정 2026-05-25 |
| D-009 | **뉴스 API = GNews** | 무료 100req/day, 한국어 지원, REST 단순 | 사용자 결정 (오토 추천 수락) 2026-05-25 |
| D-010 | **호스팅 = Cafe24 + Docker** | 사용자 결정. M6 배포 시점에 docker-compose 그대로 이식 가능 | 사용자 결정 2026-05-25 |
| D-011 | **iOS 배포 deferred — Android-first** | Apple Developer Program $99/yr 결제 시점 미정. M6 까지 Android (Firebase App Distribution) 만 진행, iOS 는 결제 후 TestFlight | 사용자 추천 수락 2026-05-25 |

---

## §6. 위험 / 차단 요소

| 위험 | 영향 | 완화 |
|---|---|---|
| Expo Go 만으로는 `react-native-keychain` / `@react-native-firebase` 미동작 | M1-5, M4 차단 | EAS dev build 도입 (M0-2) |
| iOS 백그라운드 캡쳐는 OS 차단 불가 | 위장 약점 | UIApplication didEnterBackground 에서 뉴스 피드로 즉시 swap + blur (handoff §6 PushNotifications) |
| 뉴스 API 무료 tier rate limit | 캐시 만료 시 504 | TTL 10분 + fallback 캐시 (REQ-004) |
| ddl.sql 변경 시 dev DB volume 재생성 필요 | 개발 친화성 | TypeORM migration 으로 점진 전환 (M1-1 이후) |
| 시퀀스 공통 `[5,3,1,7]` 노출 위험 | 보안 | 베타 그룹 6명 한정. v1.5 사용자별 커스터마이즈 시 해소 |
| 디자인 핸드오프의 `react-native-firebase` 가 Expo SDK 와 약간 충돌 | M4 푸시 차단 | Expo dev-client 사용 시 호환 (RN community 검증) |
| Apple Developer Program $99/yr 필요 | M6 배포 차단 | 사용자 결제 대기 또는 Android-first 배포 |

---

## §7. 사용자 컨펌 완료 (2026-05-25)

1. ~~D-008 워크플로우~~ → **Phase 1 Expo managed / Phase 2 RN bare** ✅
2. ~~D-009 뉴스 API~~ → **GNews** ✅
3. ~~git push~~ → **진행** ✅
4. ~~Apple Developer Program~~ → **deferred / Android-first** ✅
5. **D-010 호스팅** → **Cafe24 + Docker** ✅ (신규 결정)

남은 확인 항목 (즉시 차단 X, M6 직전):
- Cafe24 플랜 사양 / Docker 지원 / 외부 IP / SSL 정책 → M6-5 직전 사용자 제공
- GNews API key 발급 → M2-1 직전 사용자 제공
- Firebase Project ID + Service Account JSON (FCM 푸시용) → M4-3 직전

---

## §8. 시작 액션 (이번 주)

| 순서 | 작업 | Agent | 사용자 컨펌 |
|---|---|---|---|
| 1 | §7 의 4 항목 컨펌 | orchestrator | ✅ |
| 2 | 모바일 `package.json` 갱신 (D-008 따라) + `pnpm install` | infra-platform + orchestrator | — |
| 3 | `pnpm infra:up` → 백엔드 부팅 → `curl /health` 200 확인 | infra-platform | — |
| 4 | 디자인 토큰 차이 audit + `tailwind.config.js` 보강 | design-fidelity | — |
| 5 | 위장 어휘 매핑 상수 추가 (`packages/shared/src/constants/disguise.ts`) | mobile-feature-dev | — |
| 6 | TypeORM entity 14개 자동 생성 (ddl.sql 기반) | backend-domain-dev | — |
| 7 | M1 auth 도메인 본격 진입 | backend-domain-dev + mobile-feature-dev (병렬) | — |

---

## §9. 산출물 매핑 (참조 인덱스)

| 종류 | 파일 |
|---|---|
| 이 계획서 | `docs/DEVELOPMENT_PLAN.md` |
| 사용자 원본 컨텍스트 | `docs/origin/agentNews-context.md` |
| 디자인 핸드오프 (v2) | `docs/design/README.md` + `docs/design/storyboard.html` + `docs/design/designs/*.html` (9 HTML 모킹) |
| ComponentsReference (P1) | `docs/design/designs/ComponentsReference.html` — 첨부 칩 3-state / 버블 첨부 미리보기 / 빈 상태 / App Switcher swap / 메시지 재전송 |
| 요구사항 25개 | `docs/specs/base/requirements_spec.md` |
| DB 14 테이블 | `docs/specs/spec/db_design.md` + `docs/specs/spec/ddl.sql` (= `infra/postgres/init/01_schema.sql`) |
| 화면 13개 (원본) | `docs/specs/spec/screen_inventory_and_function_definition.md` |
| 시나리오 12개 | `docs/specs/spec/user_scenarios.md` |
| 개발 컨벤션 | `docs/specs/spec/development_conventions.md` |
| API 10 도메인 | `docs/specs/api/*.md` |
| 디자인 토큰 | `docs/design/README.md` §6 + `apps/mobile/tailwind.config.js` |
| 위장 검수 기준 | `docs/design/README.md` §5 + §12 |

---

_본 계획서는 살아있는 문서. M0 시작 직전 final 확인 후 즉시 실행._
