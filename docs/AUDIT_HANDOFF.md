# agentNews — Audit Handoff

> 외부 audit / security review agent 용 wrap-up. Self-contained — 이 문서만 읽고 코드 audit 가능하도록 작성.
> 작성: 2026-05-25 / 작업 기간: 2026-05-22 ~ 2026-05-25 (3.5일)
> Repo: https://github.com/whatsupjuno/agentNews_260522

---

## 1. 한 줄 정의

위장 뉴스앱 (외부 표기 **DailyNews**, 내부 코드네임 **agentNews**) + 비밀 1:1 채팅 SaaS.
친구 6명 (3 페어) 대상 비공개 데모. RN + NestJS + PostgreSQL.
외부 관찰자에게는 끝까지 평범한 뉴스 앱처럼 보여야 함.

---

## 2. 베이스 자료 (모두 self-contained, `docs/` 하위)

| 자료 | 위치 | 역할 |
|---|---|---|
| 사용자 원본 컨텍스트 | `docs/origin/agentNews-context.md` | 결정 우선순위 1순위 |
| 디자인 핸드오프 v3 | `docs/design/` | 5 화면 + ComponentsReference + PushNotifications |
| AdminScreen pending | `docs/design-admin-pending/` | 별도 작업 대기 |
| PLAN-003 산출물 22개 | `docs/specs/` | DDL 14 테이블, REQ-001~025, API 10 도메인, 시나리오 12 |
| 통합 개발 계획서 | `docs/DEVELOPMENT_PLAN.md` | 마일스톤 + agent 분담 |

---

## 3. 기술 스택 (확정)

### Phase 1 — 현재 (Expo managed)
| 영역 | 기술 |
|---|---|
| Mobile | Expo SDK 54 + RN 0.81 + React 19 + TypeScript + NativeWind v4 + React Navigation v6 |
| Mobile push | `expo-notifications` (notification only, data payload 0) |
| Mobile 토큰 저장 | `expo-secure-store` (iOS Keychain + Android Keystore) |
| Mobile 위장 | `expo-blur` (iOS bg overlay) + `expo-screen-capture` (Android FLAG_SECURE) |
| Backend | NestJS 10 + TypeScript + REST + WebSocket (`socket.io`) |
| Backend ORM | TypeORM Repository pattern (raw query 금지) |
| Backend 암호 | `bcryptjs` cost 12 / AES-256-GCM / HMAC-SHA256 / RS256/HS256 JWT |
| DB | PostgreSQL 16 + `pgcrypto` extension |
| 첨부 저장소 | MinIO 제외 (cafe24 CPU 가 x86-64-v2 미지원 — 첨부 deferred) |
| 외부 뉴스 API | mock 풀 (GNews key 미발급) |
| 컨테이너 | Docker + docker-compose |
| 호스팅 | **Cafe24 Ubuntu 22.04 LTS** + systemd |
| CI/CD | GitHub Actions → SSH → deploy-server.sh |

### Phase 2 (Post-MVP, deferred)
- RN bare workflow (`expo prebuild`) + `react-native-keychain` + `@react-native-firebase/messaging`
- Apple Developer Program + TestFlight
- 외부 S3 (Cloudflare R2 / AWS S3) for 첨부
- SSL (Let's Encrypt + nginx) + 도메인

---

## 4. 위장 원칙 (★ Audit 최우선 검수 포인트)

### 4-1. 시퀀스 입력 메커니즘 (v3 — 카테고리 pill 기반)

```
1. DailyNews 워드마크 탭 → ARM 모드 (8초 타이머)
   * 외관 변화 0 (토스트/애니/소리/진동 전부 금지)
   * 우측 프로필 아바타 배경만 #e5e5ea 회색 (본인만 인지)
2. 카테고리 strip pill 의 position 5 → 3 → 1 → 7 순서 탭
   * 매핑: 5=문화, 3=경제, 1=헤드라인, 7=사회
   * 카드 탭은 시퀀스 영향 0 (일반 기사로 열림)
3. 4번째 정탑 → POST /sequence/verify → unlock_token (60분) 발급
4. ArticleDetailScreen 으로 자연스러운 navigation = 유일한 외부 신호
   * 헤더 "기사 토론" + 본문이 채팅 UI 로 conditional swap
```

### 4-2. 위장 어휘 (외부 노출 string 만 매핑, DB 컬럼은 그대로)

| 외부 노출 | 내부 코드 |
|---|---|
| "구독자" | `pair` / `pairing` |
| "기사 토론" | `chat` / `discussion` |
| "콘텐츠 잠금 코드" | `secret_sequence` |
| "댓글" / "댓글 입력" | `message` |

- 자동 검수: `scripts/disguise-grep.sh` (apps/mobile/src/screens 에서 금지 단어 grep)
- 통과 기준: 외부 노출 string 에 `chat / secret / agent / message / 채팅 / 비밀 / 메시지 / 에이전트` 0건

### 4-3. 즉시 disarm 정책 (REQ-023 강화)

- AppState `inactive` / `background` 진입 즉시 `unlock.clear()`
- ArticleDetail useEffect 가 isUnlocked 변화 감지 → `navigation.popToTop()`
- foreground 복귀 시 항상 NewsFeed (채팅 흔적 0)
- 기존 정책 (5초 마진) 제거됨

### 4-4. App Switcher 스냅샷 방어

- iOS: `expo-blur` overlay (채팅 모드 활성 시만)
- Android: `expo-screen-capture` (preventScreenCaptureAsync)
- 채팅 모드 비활성 시 `allowScreenCaptureAsync` 복구

### 4-5. 푸시 위장 (현재 local notification 로 시연)

- title: `📰 새 뉴스`
- body: 랜덤 가짜 헤드라인 (FAKE_HEADLINE_FALLBACK_POOL 10개 + DB fake_headlines 50개)
- **`data` payload 의도적 미사용** (notification only)
- tap 시 cold/warm start 모두 NewsFeed 진입 (자동 채팅 진입 금지)
- 백엔드 worker: `notification_queue` 0~60초 jitter (REQ-022). FCM 자격증명 미설정으로 실 발송 deferred

### 4-6. 시각 피드백 = "신호 0"

- showToast() 호출 0건 (handoff v2 갱신 후 정책)
- 카드 정/오답 시각 피드백 0
- auto-disarm 8초 silent
- 유일한 외부 신호: 시퀀스 완성 시 ArticleDetail chat swap

---

## 5. 보안 / 암호

### 5-1. 사용 알고리즘
- 비밀번호: `bcryptjs` cost 12
- 메시지 본문: AES-256-GCM (key 32B, iv 12B, tag 16B 분리 컬럼)
- 시퀀스 해시: HMAC-SHA256 + 16B salt
- JWT: access 15분 / refresh 30일 / unlock 60분 (handoff §8.4 따라 v3 변경)
- 환경변수: MESSAGE_ENC_KEY (32B base64), SEQUENCE_HMAC_KEY, JWT_*_SECRET (각각 32B hex)

### 5-2. Token 재발급
- access 만료 30초 전 미리 refresh (JWT exp claim 검사, mobile 측 atob 디코드)
- refresh 실패 시 어떤 종류든 (401 / network / 5xx) → 강제 `forceUnauthenticated()` → secureStore clear
- refresh rotate (사용 후 revokedAt 설정)

### 5-3. 외부 코드 리뷰 (Dex) 지적 3건 fix
1. **WebSocket handshake unlock token 필수** (`message.gateway.ts`)
   - access + unlock 둘 다 검증, unlock.sub === access.agentId 일치 확인
2. **ArticleDetail unlock 만료 시 자동 popToTop** (`ArticleDetailScreen.tsx`)
   - `isChat = forceMode === 'normal' ? false : isUnlocked` + useEffect popToTop
3. **UnlockTokenGuard sub 검증** (`unlock-token.guard.ts`)
   - `payload.kind === 'unlock' && payload.sub === req.agent.id` 확인
   - 실패 시 위장 응답 (`DisguiseExceptionFilter` → 404 NEWS_ARTICLE_NOT_FOUND)

### 5-4. 위장 응답 (`DisguiseExceptionFilter`)
- 비밀 도메인 (`/unlock`, `/pairings`, `/messages`, `/attachments`) 모든 4xx → 404 NEWS_ARTICLE_NOT_FOUND 단일 형태
- HTTP status code, 응답 body 모두 정상 뉴스 API 와 구분 불가
- 내부 audit log 에만 진짜 error code 기록

### 5-5. CORS / network
- `CORS_ORIGIN` env (현재 wildcard `*`, 운영 시 좁힘 필요)
- `app.listen('0.0.0.0')` — 외부 접근 (Docker / cafe24)
- HTTP only (SSL 미적용 — Phase 1.5 도메인 확보 후)

---

## 6. 데이터 모델 (14 테이블, ddl.sql 1:1)

```
agents (소셜 사용자 X, userId = email 컬럼에 의미 변환 저장)
├─ agent_secret_sequences (1:1)
├─ unlock_sessions
├─ refresh_tokens
├─ push_tokens
├─ sequence_reset_tokens (Phase 1.5+)
├─ idempotency_keys
└─ pairings ─→ messages ─→ message_attachments (Phase 1.5+)
              ↓
       notification_queue ←─── fake_headlines
audit_logs (append-only, UPDATE/DELETE 트리거 차단)
news_articles_cache (현재 mock 풀 사용, 미적재)
```

- `external_id uuid` — 외부 API 응답용 (IDOR 차단 SEC-004), agents/pairings/messages/message_attachments/notification_queue
- `email` 컬럼에 userId 저장 (v3 의미 변환, DDL 변경 회피)
- `pairings` partial unique: 1 agent = 1 active pair (PAIRED/PAIRING_REQUESTED)
- `messages` 본문 ciphertext / iv / tag 별도 컬럼
- 14 테이블 cafe24 Postgres 자동 적재 (`docker-entrypoint-initdb.d`)

---

## 7. 인증 / 사용자 ID

### 7-1. ID 규칙 (v3 변경)
- regex: `/^[a-zA-Z0-9가-힣]{1,10}$/` (10자 이내, 영문/숫자/한글)
- 이전 (deprecated): 4-20자 영문/숫자/_

### 7-2. 데모 계정 (운영 코드 leak 주의 — audit 포인트)
- `demo / demo1234` — `DemoAccountService.onApplicationBootstrap` 에서 자동 생성
- `friend / friend1234` — 친구 데모 (수동 register API 호출 + DB pairing INSERT)
- echo bot (이메일 `echo-{uuid}@bot.dailynews.local`) — 회원가입 시 1인당 자동 페어링
  - `EchoBotService.attachToNewAgent()` — 시퀀스 자동 등록 + PAIRED + 시드 메시지 2개
- `MessageService.maybeEchoReply` — bot 자동 응답 (0.8초 delay, WebSocket broadcast)

---

## 8. 환경 분리 (env-driven)

### Mobile
| 환경 | 결정 source |
|---|---|
| Expo Go (dev) | `Constants.hostUri` 자동 추출 (LAN IP), 또는 `.env` 의 EXPO_PUBLIC_API_BASE_URL |
| EAS preview build | `eas.json` preview profile env |
| EAS production build | `eas.json` production profile env |

현재 `apps/mobile/.env`: `EXPO_PUBLIC_API_BASE_URL=http://58.229.163.104:3000/api/v1`

### Backend
- `DATABASE_URL`, `MESSAGE_ENC_KEY`, `SEQUENCE_HMAC_KEY`, `JWT_*_SECRET`
- `CORS_ORIGIN` (default `*`)
- `BACKEND_PUBLIC_URL` (예: http://58.229.163.104:3000) — 향후 reset 메일 등
- `NODE_ENV`, `BACKEND_PORT`, `LOG_LEVEL`

---

## 9. 배포 (cafe24 — 라이브 운영 중)

### 9-1. 서버 사양
- IP `58.229.163.104` (shconstruct.cafe24.com)
- Ubuntu 22.04 LTS / RAM 1GB / Disk 30GB / Swap 3.7GB / 1 vCPU
- Docker 29.5 + Compose v5.1 + Node 22.22 + pnpm 10.32

### 9-2. 프로세스 / 자동 시작
- `/etc/systemd/system/agentnews-backend.service` — auto-restart, /var/log/agentnews-backend.log
- Postgres docker container — `restart=unless-stopped`, ddl.sql 14 테이블 자동 적재
- MinIO 제외 (Cafe24 CPU 가 minio:latest 의 x86-64-v2 micro-arch 미지원)

### 9-3. 방화벽
- Ubuntu ufw: INBOUND `22 + 3000` only, OUTBOUND allow
- Cafe24 자체 방화벽: OFF 권장 (ufw 사용 시)
- Postgres 5432 / MinIO 9000-9001 외부 차단 (Docker container 내부만)

### 9-4. 라이브 검증
- `curl http://58.229.163.104:3000/api/v1/health` → 200
- `demo/demo1234` 로그인 → /me OK
- friend↔demo 실시간 채팅 e2e PASS (DB messages 테이블 AES-GCM ciphertext 저장 확인)

---

## 10. CI/CD

### 10-1. Workflow
- `.github/workflows/deploy.yml` — main push (backend/shared/infra 경로) → SSH → `deploy-server.sh`
- `appleboy/ssh-action@v1.2.0`
- concurrency group `deploy-cafe24` (직렬 배포)

### 10-2. Deploy script (`scripts/deploy-server.sh`)
1. `git pull` (reset --hard origin/main)
2. `pnpm install --frozen-lockfile --prod=false`
3. `npx tsc ... src/main.ts` (NestJS 의 nest build 가 일부 환경에서 silent fail → 직접 tsc 사용)
4. `systemctl restart agentnews-backend`
5. health check (`curl /api/v1/health`)

### 10-3. Secrets (사용자 등록 대기)
- `CAFE24_HOST = 58.229.163.104`
- `CAFE24_USER = root`
- `CAFE24_SSH_KEY` (`~/.ssh/cafe24_agentnews` private key)

### 10-4. Self-test 결과
- 수동 ssh + bash deploy-server.sh: 28초 만에 git pull → 빌드 → restart → health OK

---

## 11. EAS Update / Build

### 11-1. EAS Update (push 됨, Expo Go 미호환)
- Project: `@whatsupjuno/dailynews` (projectId `9fa59ec8-bd44-456b-b0cf-7703db725c15`)
- Branch `preview` push 됨
- **Expo Go SDK 50+ 에서는 EAS Update branch URL 직접 로드 불가** — standalone build 후 OTA 용
- 첫 friend test 는 `expo start --tunnel` (ngrok) 로 우회

### 11-2. EAS Build (deferred)
- Android APK preview build: 친구가 Android 폰 있을 때 검토
- iOS: Apple Developer Program $99/yr 결제 후 TestFlight

---

## 12. 현재 라이브 환경 (실 운영)

```
[Cafe24 서버] 58.229.163.104
  ├─ Docker postgres (14 테이블 적재, restart=unless-stopped)
  ├─ systemd agentnews-backend (node dist/main.js, auto-restart)
  └─ ufw: 22 + 3000

[모바일]
  apps/mobile/.env: EXPO_PUBLIC_API_BASE_URL=http://58.229.163.104:3000/api/v1
  → 어디서든 외부 인터넷으로 cafe24 접속

[데모 계정]
  demo / demo1234   ← 사용자
  friend / friend1234 ← 친구
  PAIRING status=PAIRED (DB INSERT, echo bot 페어링 해제 후)

[ngrok tunnel] (사용자 사무실 Mac, ngrok free 4h inactive / 8h max)
  exp://er2okmc-whatsupjuno-8081.exp.direct
  ← 친구 Expo Go 가 이 URL 로 dev bundle 로드. Mac 켜져 있어야.
```

---

## 13. Deferred / 미완 항목 (Phase 1.5+)

| 영역 | 상태 |
|---|---|
| 첨부 업로드 | UI placeholder 만. MinIO 미사용 (CPU 호환성). 외부 S3 검토 |
| FCM 위장 푸시 | `notification_queue` 백엔드 worker stub. Firebase 자격증명 필요 |
| 외부 뉴스 API | mock 풀 7개. GNews API key 발급 후 swap |
| 페어링 UI | DB INSERT 수동. v1.5+ 사용자 검색/요청/수락 flow |
| 시퀀스 변경 / reset UI | 화면 stub 제거됨. DB 수동 |
| AdminScreen | `docs/design-admin-pending/` 보관. 신규 admin role + UI |
| SSL / 도메인 | http 평문. Let's Encrypt + nginx 필요 |
| Apple Dev / TestFlight | iOS standalone 배포 deferred |
| Audit log query API | append-only 저장만, 조회 endpoint 없음 |

---

## 14. ⚠️ Audit 포커스 — 검수해야 할 핵심 지점 14가지

### 위장
1. **UI 노출 문자열 grep** — `scripts/disguise-grep.sh` 가 false positive 다듬어졌지만 manual check 권장 (특히 한국어 형태소 변형)
2. **시퀀스 silent 동작** — `useFeedSequence.ts` 의 모든 분기에서 showToast 류 호출 0인지
3. **App Switcher 위장** — iOS expo-blur 가 chat mode 활성 즉시 overlay, Android FLAG_SECURE 토글 race condition
4. **위장 응답 leak** — `DisguiseExceptionFilter` 가 모든 비밀 도메인 path 매칭하는지 (`/api/v1/sequence/*` 은 의도적 제외 — 검토 필요)

### 인증 / 권한
5. **JwtAuthGuard 적용 누락 확인** — `/health`, `/auth/*` 제외 모든 컨트롤러에 적용
6. **UnlockTokenGuard sub 검증** — Dex fix 적용됨. `kind === 'unlock'` 추가 검증 OK
7. **WebSocket handshake** — unlock token 필수 + cross-token reuse 차단
8. **Refresh rotation** — 사용된 jti revoke + 새 jti 발급. timing-safe HMAC compare 사용 (sequence.service)

### 데이터
9. **AES-GCM iv 재사용 위험** — `crypto.service.ts` 의 `encryptMessage` 가 매번 새 randomBytes(12). 검증
10. **bcryptjs cost 12** — 1GB RAM 서버에서 동시 가입 시 부담. concurrency throttle 검토
11. **DB schema vs entity 매핑** — 14 entity 의 nullable 정합, FK ON DELETE 정책 (RESTRICT vs CASCADE)

### 운영
12. **Demo 코드 leak** — `DemoAccountService` / `EchoBotService` 가 production 환경에서도 동작. 운영 swap 또는 NODE_ENV 가드 필요
13. **CORS wildcard** — 현재 `*`. 운영 시 명시 origin 으로 좁히기 (모바일 native 만 쓰면 무관)
14. **로그 평문 leak** — `crypto.service.ts` 의 `console.warn` 에 dev fallback key 출력 (dev only, prod 영향 X)

### 부가
- HTTP 평문 (SSL 부재) — Phase 1.5 권장
- audit_logs 미사용 (controller / use-case 어디서도 insert 안 함) — REQ-025 미이행
- IdempotencyGuard 미적용 — POST/PUT/DELETE 에 적용 권장 (REQ-008)
- Rate limit 미적용 — 시퀀스 1초 미만 재탭 차단은 mobile 측 (`useFeedSequence.lastTapTimesRef`) 만. 서버측 부재

---

## 15. 파일 / 경로 인덱스

| 항목 | 위치 |
|---|---|
| **이 문서** | `docs/AUDIT_HANDOFF.md` |
| 통합 개발 계획서 | `docs/DEVELOPMENT_PLAN.md` |
| 사용자 원본 컨텍스트 | `docs/origin/agentNews-context.md` |
| Design v3 (9 HTML + 8 jsx) | `docs/design/` |
| AdminScreen pending | `docs/design-admin-pending/` |
| PLAN-003 스펙 (22 산출물) | `docs/specs/` |
| Backend root | `apps/backend/src/` |
| Backend modules | `auth.module.ts`, `news.module.ts`, `sequence.module.ts`, `message.module.ts`, `user.module.ts` |
| Backend entities | `apps/backend/src/infrastructure/database/entities/` (14 entity) |
| Backend crypto | `apps/backend/src/infrastructure/crypto/crypto.service.ts` |
| Backend demo | `apps/backend/src/infrastructure/demo/` (echo-bot + demo-account) |
| Backend disguise filter | `apps/backend/src/presentation/filters/disguise-exception.filter.ts` |
| Backend WebSocket | `apps/backend/src/presentation/gateways/message.gateway.ts` |
| Backend guards | `apps/backend/src/presentation/guards/jwt-auth.guard.ts`, `unlock-token.guard.ts` |
| Mobile root | `apps/mobile/` |
| Mobile screens | `apps/mobile/src/screens/` (Login/Register/NewsFeed/ArticleDetail/Settings/ProfileEdit) |
| Mobile hooks | `apps/mobile/src/hooks/` (useFeedSequence, useChat, useBackgroundDisguise) |
| Mobile store | `apps/mobile/src/store/` (auth, unlock) |
| Mobile services | `apps/mobile/src/services/` (api, secureStore, demoPush) |
| Mobile config | `app.json`, `eas.json`, `tailwind.config.js`, `metro.config.js` |
| Shared types | `packages/shared/src/` (types, constants/status, constants/disguise, constants/error-codes) |
| Infra | `infra/docker-compose.yml`, `infra/postgres/init/01_schema.sql` |
| Scripts | `scripts/deploy-server.sh`, `scripts/disguise-grep.sh`, `scripts/start-all.sh`, `scripts/stop-all.sh` |
| CI/CD | `.github/workflows/deploy.yml` |

---

## 16. Commit 히스토리 (origin/main, 최신순)

| Hash | 메시지 |
|---|---|
| `b48243d` | ci: GitHub Actions deploy to cafe24 + server deploy script |
| `f0aa085` | feat: env-driven API host for staging/production deploys |
| `5989209` | feat: design v3 — 5 수정사항 반영 |
| `9b4e934` | feat(mobile): instant disarm on any backgrounding (위장 강화) |
| `ce198f2` | feat: switch email→userId login + auto demo account (demo/demo1234) |
| `ed3e551` | fix(mobile): force unauthenticated on any refresh failure |
| `f750008` | feat(mobile): upgrade to Expo SDK 54 + demo push + auto token refresh |
| `ca49917` | fix: close 3 disguise/lock gaps flagged by code review (Dex) |
| `a9c90bf` | feat: MVP working app — backend + mobile + demo mode + e2e |
| `69a2365` | docs: integrate design handoff v2 + lock tech stack decisions |
| `e04d917` | chore: initialize agentNews monorepo scaffold |

---

## 17. Audit agent 진입 방법

```bash
git clone https://github.com/whatsupjuno/agentNews_260522.git
cd agentNews_260522
cat docs/AUDIT_HANDOFF.md   # 이 문서
cat docs/DEVELOPMENT_PLAN.md
cat docs/origin/agentNews-context.md
# 그 후 §14 의 14 검수 포인트 순서대로 검사
```

라이브 백엔드 검수 시:
```
curl http://58.229.163.104:3000/api/v1/health
# 데모: userId=demo password=demo1234
```

---

**핵심 risk 한 줄 요약**: 위장 원칙 정합성 (§4) + Dex fix 3건 (§5-3) + Demo 코드 leak 가드 (§14-12) + audit_logs 미이행 (§14 부가) 가 가장 audit 가치 높은 부분.
