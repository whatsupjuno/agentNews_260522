# agentNews 개발 컨벤션 v1.0

---

## 1. 기술 스택

| 영역 | 기술 |
|---|---|
| 모바일 | React Native 0.74+ + TypeScript (RN bare workflow, Expo 미사용) |
| 모바일 푸시 SDK | @react-native-firebase/messaging (FCM 단일 — iOS 는 FCM 이 APNs 자동 중계) |
| 모바일 토큰 저장 | react-native-keychain (httpOnly cookie 금지) |
| 모바일 파일 picker | react-native-image-picker, react-native-document-picker |
| 모바일 네비게이션 | React Navigation (Stack). 채팅 화면은 ArticleDetailScreen 내부 conditional swap |
| 백엔드 | NestJS 10+ + TypeScript + REST |
| 백엔드 ORM | TypeORM (Repository pattern). raw query 금지 |
| 백엔드 WebSocket | @nestjs/websockets + Socket.IO |
| 백엔드 푸시 | firebase-admin (Node SDK) |
| 백엔드 암호 | bcrypt cost 12 / crypto.createCipheriv (AES-256-GCM) / crypto.createHmac (HMAC-SHA256) |
| DB | PostgreSQL 16 + pgcrypto extension |
| 첨부 저장소 | MinIO (S3 호환) — @aws-sdk/client-s3 |
| 외부 뉴스 API | GNews / MediaStack / NewsAPI.org 중 무료 tier 선정 (A-007) |
| 이메일 발송 | SMTP (시퀀스 reset 링크 전용. 운영용 외 미사용) |
| 컨테이너 | Docker + docker-compose |
| 배포 (iOS) | TestFlight (Apple Developer Program $99/yr) |
| 배포 (Android) | Firebase App Distribution |

---

## 2. 폴더 구조 (Clean Architecture 4계층)

백엔드 NestJS 의 src/ 하위 구조:

```
src/
├─ presentation/        # HTTP / WS 진입점 — 외부 노출
│   ├─ controllers/     # REST Controller (NestJS @Controller)
│   ├─ gateways/        # WebSocket Gateway
│   ├─ dto/             # Request / Response DTO (class-validator)
│   ├─ guards/          # JwtAuthGuard, UnlockTokenGuard, IdempotencyGuard
│   ├─ filters/         # ExceptionFilter (위장 응답 변환 — DisguiseExceptionFilter)
│   └─ interceptors/    # ResponseFormatInterceptor, AuditLogInterceptor
├─ application/         # UseCase 단위 비즈니스 흐름
│   ├─ use-cases/       # ex. SendMessageUseCase, RequestPairingUseCase
│   ├─ commands/        # CQS 명령 객체
│   └─ services/        # 도메인 간 조정 서비스
├─ domain/              # 순수 도메인 (외부 의존 0)
│   ├─ entities/        # Agent, Pairing, Message, Attachment ...
│   ├─ value-objects/   # ExternalId, SequenceHash, EncryptedBody ...
│   ├─ policies/        # PairingSlotPolicy, MessageRetentionPolicy ...
│   └─ events/          # 도메인 이벤트 (PairingDisconnected 등)
└─ infrastructure/      # 외부 시스템 연동
    ├─ repositories/    # TypeORM Repository 구현
    ├─ storage/         # MinIO 클라이언트 (presigned URL 발급)
    ├─ push/            # firebase-admin 어댑터
    ├─ news/            # 외부 뉴스 API 클라이언트
    ├─ mail/            # SMTP 발송기
    └─ crypto/          # AES-GCM / bcrypt / HMAC 래퍼
```

**의존성 방향**: presentation → application → domain ← infrastructure. domain 은 어떤 모듈도 import 하지 않는다.

**금지**: Controller 가 Repository 직접 호출 / domain entity 가 NestJS / TypeORM decorator 사용.

---

## 3. 명명 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| DB table | `snake_case` (복수형) | `agents`, `message_attachments` |
| DB column | `snake_case` | `external_id`, `created_at` |
| DB enum 값 / 상태값 | `SCREAMING_SNAKE_CASE` | `PAIRING_REQUESTED`, `AVAILABLE` |
| TS class | `PascalCase` | `SendMessageUseCase`, `Pairing` |
| TS interface | `PascalCase` (접두 `I` 금지) | `MessageRepository` |
| TS function / variable | `camelCase` | `sendMessage`, `pairingId` |
| TS 상수 | `SCREAMING_SNAKE_CASE` | `MESSAGE_ENC_KEY`, `MAX_ATTACHMENT_SIZE_MB` |
| 파일 | `kebab-case` | `send-message.use-case.ts` |
| 디렉토리 | `kebab-case` | `use-cases/` |
| API URL | `kebab-case` + 명사 복수형 | `/api/v1/pairings`, `/api/v1/messages` |
| 에러 코드 | `<DOMAIN>_<ISSUE>` SCREAMING | `AUTH_INVALID_CREDENTIALS` |
| 환경 변수 | `SCREAMING_SNAKE_CASE` | `JWT_ACCESS_SECRET`, `MESSAGE_ENC_KEY` |
| audit_logs.kind | `<DOMAIN>_<ACTION>` SCREAMING | `PAIRING_ACCEPT`, `MESSAGE_SEND` |

**RN 측 추가**: 컴포넌트 = `PascalCase.tsx` (예: `ArticleDetailScreen.tsx`), 훅 = `useCamelCase.ts`.

---

## 4. 공통 응답 포맷

### 4-1. 성공 응답

```json
{
  "success": true,
  "data": { /* 도메인 페이로드 */ },
  "meta": {
    "timestamp": "2026-05-19T12:00:00.000Z",
    "traceId": "uuid-v4"
  }
}
```

### 4-2. 실패 응답 — 일반 (앱 내부 화면용)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "사람이 읽을 수 있는 메시지 (위장 불필요한 앱 내부 화면)",
    "details": { "field": "email" },
    "traceId": "uuid-v4"
  },
  "meta": { "timestamp": "..." }
}
```

### 4-3. 실패 응답 — 위장 (외부 노출 endpoint)

채팅 / 페어링 / 첨부 등 비밀 도메인 endpoint 의 모든 권한 거부는 다음 단일 형태로 반환:

```json
{
  "success": false,
  "error": {
    "code": "NEWS_ARTICLE_NOT_FOUND",
    "message": "기사를 찾을 수 없습니다.",
    "traceId": "uuid-v4"
  },
  "meta": { "timestamp": "..." }
}
```

HTTP status = **404**. 외부에서 일반 뉴스 API 응답과 구분 불가해야 한다 (SEC-006, REQ-009).

**위장 응답 변환 위치**: `presentation/filters/DisguiseExceptionFilter`. 비밀 도메인 라우트 metadata 에 `@DisguiseOnError()` 데코레이터 부착 시 자동 적용.

### 4-4. 라우트별 응답 모드

| 라우트군 | 응답 모드 |
|---|---|
| `/api/v1/auth/*` (가입/로그인/로그아웃) | 일반 (앱 내부) |
| `/api/v1/news/*` (뉴스 피드) | 일반 |
| `/api/v1/sequence/*` (시퀀스 등록/변경/reset) | 일반 |
| `/api/v1/unlock/*` (시퀀스 검증) | **위장** (실패 시 정상 200 + 가짜 기사 상세) |
| `/api/v1/pairings/*` | **위장** |
| `/api/v1/messages/*` | **위장** |
| `/api/v1/attachments/*` | **위장** |
| WebSocket `/ws` | **위장** (handshake 거부 = 404) |

---

## 5. 에러 코드 규칙

형식: `<DOMAIN>_<ISSUE>` (SCREAMING_SNAKE_CASE). 비밀 도메인의 외부 응답은 `NEWS_ARTICLE_NOT_FOUND` 로 통일되므로, 다음 코드는 내부 로그·audit·앱 내부 화면 전용이다.

| 도메인 | 코드 예 |
|---|---|
| AUTH | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `AUTH_REFRESH_REVOKED`, `AUTH_EMAIL_DUPLICATE` |
| SEQUENCE | `SEQUENCE_INVALID_LENGTH`, `SEQUENCE_VERIFY_REQUIRED`, `SEQUENCE_RESET_LINK_EXPIRED` |
| UNLOCK | `UNLOCK_TOKEN_EXPIRED`, `UNLOCK_REVOKED` (내부 audit 전용) |
| PAIRING | `PAIRING_ACTIVE_SLOT_OCCUPIED`, `PAIRING_NOT_FOUND`, `PAIRING_ALREADY_PROCESSED` (내부 전용) |
| MESSAGE | `MESSAGE_PAIR_NOT_PAIRED`, `MESSAGE_BODY_TOO_LARGE` (내부 전용) |
| ATTACHMENT | `ATTACHMENT_MIME_NOT_ALLOWED`, `ATTACHMENT_SIZE_EXCEEDED`, `ATTACHMENT_MAGIC_BYTE_MISMATCH` |
| IDEMPOTENCY | `IDEMPOTENCY_KEY_MISSING`, `IDEMPOTENCY_KEY_CONFLICT` |
| NEWS | `NEWS_ARTICLE_NOT_FOUND` (외부 위장 응답 공통) |

---

## 6. 트랜잭션 / 감사

- **UseCase = 트랜잭션 경계**. UseCase 의 `execute()` 메서드 단위로 단일 DB 트랜잭션. 부분 실패 시 전체 롤백.
- **상태 전이 = audit_logs 1 row**. state_transition_table.md §10 의 23종 audit 이벤트는 모두 동일 트랜잭션 안에서 append.
- **외부 부수효과는 commit 후**: FCM 푸시 / 이메일 발송 / MinIO presigned URL 발급은 트랜잭션 commit 성공 후 별도 worker queue 로 위임. 트랜잭션 안에서 직접 호출 금지.
- **audit_logs append-only**: DB 트리거로 UPDATE/DELETE 차단 (SEC-010).
- **cascade hard delete (페어 해제)**: `DELETE FROM messages WHERE pairing_id=? ; DELETE FROM message_attachments WHERE message_id IN (...) ;` 같은 트랜잭션 내 + MinIO 삭제는 commit 후 worker.

---

## 7. 보안 컨벤션

1. **bcrypt cost 12**. 평문 비밀번호 DB 저장 금지 (SEC-001).
2. **JWT**: access 15분 / refresh (`X-Refresh-Token` 헤더, 30일) / unlock_token 30분 (`X-Unlock-Token` 헤더). 모두 RS256 또는 HS256 + 환경변수 시크릿 (SEC-003).
3. **토큰 저장**: react-native-keychain 만. httpOnly cookie 금지.
4. **메시지 본문 암호화**: AES-256-GCM, key = `MESSAGE_ENC_KEY` 환경변수 (32B base64). iv 12B 랜덤, tag 16B. DB 컬럼은 ciphertext / iv / tag 분리 저장 (SEC-002).
5. **시퀀스 해시**: HMAC-SHA256 (key = `SEQUENCE_HMAC_KEY` 환경변수) + salt 16B 랜덤. 평문 및 가역 형태 저장 금지 (SEC-009).
6. **external_id (uuid v4)**: pairings / messages / message_attachments / notification_queue 모든 외부 API 응답에 사용. internal bigserial 노출 금지 (SEC-004).
7. **위장 응답 강제**: 비밀 도메인 라우트에서 모든 권한 거부 / unlock 만료 / 페어 없음 → `404 NEWS_ARTICLE_NOT_FOUND`. 내부 audit 와 외부 응답을 분리해 정보 누설 차단.
8. **WebSocket 자동 join**: handshake 후 서버가 `pairing:<pairing_id>` 채널에 join. 클라이언트 `subscribe`/`join` 이벤트는 게이트웨이 핸들러 미등록 (SEC-005).
9. **Idempotency-Key**: POST/PUT/DELETE 모든 mutating 요청 필수. 24시간 캐시 (Redis 또는 idempotency_keys 테이블). 중복 키 + 다른 body 면 `IDEMPOTENCY_KEY_CONFLICT` 내부 오류 (SEC-008).
10. **첨부 매직바이트 검증**: 업로드 stream 의 첫 64B 를 sniff. declared MIME 과 실제 시그니처 불일치 시 거부 (SEC-007).
11. **MIME allow-list**: image/jpeg, image/png, image/webp, application/pdf (4종). 그 외 거부.
12. **rate limit**: 시퀀스 검증은 1초 내 동일 article 재탭 무시 (서버 메모리 또는 Redis). LOCKED_OUT 미도입.
13. **ORM 파라미터 바인딩** 강제. raw query 금지.
14. **이메일 노출 차단**: 사용자 검색·페어링·프로필 API 응답에 이메일 포함 금지. external_id + 닉네임만.
15. **audit_logs 보존 1년**, 그 외 메시지/첨부 90일, 캐시 TTL 10분.
16. **pgcrypto extension**: uuid 생성용. `gen_random_uuid()` 사용.
17. **백그라운드 5초+ unlock 자동 종료**: 모바일이 BE 에 ping. 단순 클라이언트 신뢰 X — 서버측 last_seen_at 기록 + 5초 이상 차이 시 REVOKED 처리.
18. **viewer 위장 강화**: 채팅 화면이 활성 중일 때 OS 의 task switcher 스냅샷 차단 (RN: `enableScreenshotProtection`, iOS UIApplication didEnterBackground 시 뉴스 피드 화면으로 즉시 전환 후 스크린샷 캡처).

---

## 8. 금지 패턴

- ❌ PUT (PATCH 사용. 전체 교체 케이스도 PATCH 로 통일)
- ❌ GraphQL (REST + WebSocket 만)
- ❌ Active Record (Repository pattern 만)
- ❌ TypeORM `synchronize: true` (migration 만 사용)
- ❌ TS `any` 타입 (`unknown` + narrowing)
- ❌ 빈 catch 블록 (`catch { /* ignored */ }`)
- ❌ `console.log` 잔존 (Logger 만)
- ❌ `dangerouslySetInnerHTML` / `eval`
- ❌ `ts-ignore` / `eslint-disable` (사유 주석 + 만료 일자 없으면 PR 거부)
- ❌ Controller 에서 Repository 직접 호출 (반드시 UseCase 경유)
- ❌ 도메인 entity 에서 NestJS / TypeORM decorator
- ❌ 토큰을 응답 body 또는 cookie 로 발급 (header `Authorization` / `X-Refresh-Token` / `X-Unlock-Token` 만)
- ❌ 위장 도메인 endpoint 의 stack trace / 내부 에러 코드 외부 노출
- ❌ FCM data payload (`data` 필드) 사용 (notification 필드만)
- ❌ 외부 API 응답에 internal id, 이메일, 시퀀스 평문, 메시지 평문 포함
- ❌ migration 외 DB 스키마 직접 수정
- ❌ 디버그 로그에 시퀀스 / 비밀번호 / 메시지 본문 / JWT 토큰 평문 출력

---

## 9. 테스트 / CI

- **단위 테스트**: domain + application 계층 80% 이상 커버리지. infrastructure 는 통합 테스트 중심.
- **통합 테스트**: testcontainers (PostgreSQL 16 + MinIO) 로 격리. mock DB 금지.
- **E2E**: 백엔드 supertest, 모바일 Detox (선택).
- **CI 게이트**: lint + typecheck + 단위 + 통합 모두 통과. coverage 미달 시 머지 차단.
- **migration 검증**: PR 시 down migration dry-run 필수.

---

## 10. 환경 변수 (필수)

| 키 | 용도 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `JWT_ACCESS_SECRET` | access token HMAC 시크릿 |
| `JWT_REFRESH_SECRET` | refresh token HMAC 시크릿 |
| `JWT_UNLOCK_SECRET` | unlock_token HMAC 시크릿 (별도) |
| `MESSAGE_ENC_KEY` | AES-256-GCM key (32B base64) |
| `SEQUENCE_HMAC_KEY` | 시퀀스 해시 HMAC key |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | MinIO 접속 |
| `FCM_PROJECT_ID` / `FCM_SERVICE_ACCOUNT_JSON` | firebase-admin |
| `NEWS_API_KEY` / `NEWS_API_PROVIDER` | 외부 뉴스 API |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | 시퀀스 reset 메일 |

운영 환경 비밀은 Docker secret 또는 환경 변수 주입. 코드/이미지에 하드코딩 금지.

---

## 전제 / 우선순위 적용

- **위장 응답 통일**: 비밀 도메인 endpoint 의 외부 응답은 단일 형태로 통일. 내부 에러 코드는 audit 와 앱 내부 화면용만.
- **단일 사용자 유형**: admin 계정/화면 v1 미도입. 운영 작업은 DB 직접 접근.
- **RN bare workflow**: Expo 미사용 (PLAN-001 v1.2 결정). FCM 단일 (iOS 도 firebase-admin 이 APNs 자동 중계).
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-DEV-CONVENTIONS_
