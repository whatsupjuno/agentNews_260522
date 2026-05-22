# notification API 명세서 v1.0

---

## 1. 개요

notification API 는 위장 푸시 알림의 사용자 측 설정 / 디버깅 endpoint 와 백엔드 worker (`NotificationDispatchWorker`) + FCM 어댑터 사양을 정의한다.

위장 푸시의 큐잉 자체는 다른 도메인의 책임이다:

- 메시지 전송 → `notification_queue` INSERT (message §4-1)
- 페어링 요청 → INSERT (pairing §4-1)
- 페어링 거부 → INSERT (pairing §4-4)

본 도메인은 큐를 소비해 FCM 으로 발송하는 worker 와 사용자 측 알림 설정 동기화 endpoint 를 정의.

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | JWT access token (preferences / dry-run 모두) |

**공통 규칙**:
- 알림 본문은 *항상* 위장 — `📰 새 뉴스 — {가짜 헤드라인}` (REQ-021)
- FCM data payload **금지** (data-only / silent push 차단 — REQ-021, dev_conventions §8)
- jitter 0~60초 적용 (REQ-022)
- 페어 / unlock 상태와 무관하게 발송 — 알림은 위장이므로 잠금 상태에도 도착해야 함 (사용자 인식상 일반 뉴스 알림)
- FCM 토큰은 `push_tokens` 테이블 + auth 도메인 `POST /auth/push-token` 으로 등록

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 | 응답 모드 |
|---|---|---|---|---|---|
| 1 | GET | `/api/v1/notifications/preferences` | 본인 알림 설정 조회 (활성 FCM 토큰 / 카테고리 등) | access | 일반 |
| 2 | POST | `/api/v1/notifications/dry-run` | 가족 위장 테스트 — 본인 기기에 위장 푸시 1건 즉시 발송 | access | 일반 |

추가로 §5 이하에서 **내부 worker** 와 **FCM 어댑터** 를 명세 (외부 endpoint 아님, 시스템 아키텍처 일부).

---

## 3. 공통 응답 포맷

본 도메인의 사용자 endpoint 는 **앱 내부 화면** (설정) 전용이므로 development_conventions §4-2 (일반) 사용.

---

## 4. 엔드포인트 상세

### 4-1. 본인 알림 설정 조회

**메서드 + URL**: `GET /api/v1/notifications/preferences`

**설명**: 본인의 활성 FCM 토큰 개수, 마지막 발송 성공 시각, 발송 실패 카운터 등 알림 상태를 반환한다. 설정 화면에서 "알림이 안 와요" 디버깅용.

**인증**: 필요 (`Authorization: Bearer <access>`)

**권한**: 본인 row 만 (permission_policy §4-1-1 push_tokens)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard
2. 활성 FCM 토큰: `SELECT count(*), max(last_seen_at) FROM push_tokens WHERE agent_id=? AND deleted_at IS NULL`
3. 최근 발송 성공: `SELECT max(sent_at) FROM notification_queue WHERE recipient_agent_id=? AND status='SENT'`
4. 최근 실패 카운트 (24시간): `SELECT count(*) FROM notification_queue WHERE recipient_agent_id=? AND status='FAILED' AND created_at > now() - INTERVAL '24 hours'`
5. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "activeTokenCount": 1,
    "lastTokenSeenAt": "2026-05-20T09:50:00.000Z",
    "lastSentAt": "2026-05-20T09:55:30.000Z",
    "failedLast24h": 0
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

토큰 0개면 `lastTokenSeenAt: null`. 발송 이력 0건이면 `lastSentAt: null`.

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `INTERNAL_ERROR` | 500 | - |

**부수효과**: 없음 (조회).

---

### 4-2. 가족 위장 테스트 (dry-run)

**메서드 + URL**: `POST /api/v1/notifications/dry-run`

**설명**: 본인 기기에 위장 푸시 1건을 즉시 발송한다. brief §5 성공지표 "가족 위장 테스트 통과" 검증 도구. jitter 미적용 (즉시 발송), 그러나 본문은 실제 운영 위장 카피와 동일.

**인증**: 필요

**권한**: 본인 토큰에만 발송 (다른 agent 에게는 발송 불가)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "triggerKind": "MESSAGE_TEXT" }
```

**검증**:
- `triggerKind`: `'MESSAGE_TEXT' | 'MESSAGE_IMAGE' | 'MESSAGE_FILE' | 'PAIRING_REQUEST' | 'PAIRING_REJECT'`

**처리 흐름**:
1. JwtAuthGuard
2. 입력 검증
3. rate limit: 동일 agent_id 의 dry-run 60초 쿨다운 (스팸 차단). 위반 시 `NOTIFICATION_DRY_RUN_COOLDOWN`
4. 활성 FCM 토큰 조회: `push_tokens WHERE agent_id=? AND deleted_at IS NULL`. 토큰 0개 → `NOTIFICATION_NO_ACTIVE_TOKEN`
5. 랜덤 active 헤드라인 선택: `SELECT id, headline FROM fake_headlines WHERE is_active=true ORDER BY random() LIMIT 1`
6. notification_queue INSERT (트랜잭션 안):
   - `trigger_kind=?, fake_headline_id=?, scheduled_at=now() (jitter 미적용), trigger_message_id=NULL, trigger_pairing_id=NULL` — dry-run 은 trigger 없음
   - 단, CHECK 제약 (`trigger_kind LIKE 'MESSAGE\_%' → trigger_message_id IS NOT NULL`) 위반. **해결**: dry-run 전용 우회 — `trigger_kind='DRY_RUN'` 별도 enum 추가가 v1.1 권장. v1 은 db_design CHECK 의 alternative: dry-run 은 notification_queue 미저장 + 직접 FCM 호출만 수행
7. 트랜잭션: audit_logs INSERT `kind='NOTIFICATION_FAIL'` (kind 값을 일단 보존된 CHECK enum 안에서 사용 — 실제 운영은 v1.1 에서 `NOTIFICATION_DRY_RUN` kind 추가 권장. v1 은 audit 생략)
8. FCM 즉시 발송 (worker 거치지 않음)
9. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "dispatched": true,
    "triggerKind": "MESSAGE_TEXT",
    "headline": "정상회담 합의 도출 — 양국 신뢰 회복 신호",
    "tokenCount": 1
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `NOTIFICATION_VALIDATION_ERROR` | 400 | triggerKind 위반 |
| `NOTIFICATION_NO_ACTIVE_TOKEN` | 409 | 활성 FCM 토큰 없음 |
| `NOTIFICATION_DRY_RUN_COOLDOWN` | 429 | 60초 쿨다운 |
| `NOTIFICATION_HEADLINES_EMPTY` | 503 | fake_headlines is_active 0개 (운영 사고 — 시드 누락) |
| `NOTIFICATION_FCM_FAILED` | 502 | FCM 호출 실패 |
| `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_CONFLICT` | 400 / 409 | - |

**부수효과**:
- FCM 발송 (즉시)
- audit_logs 미기록 (v1, v1.1 에서 `NOTIFICATION_DRY_RUN` kind 추가 후 기록 권장)

---

## 5. 내부 worker — NotificationDispatchWorker

### 5-1. 책임

- `notification_queue WHERE status='QUEUED' AND scheduled_at <= now()` 폴링 → FCM 발송 → status 갱신

### 5-2. 폴링 주기 / 동시성

- 폴링 주기: 1초
- 동시 처리 N개 (예: 5 — 운영 환경 변수)
- DB 락: `SELECT ... FOR UPDATE SKIP LOCKED LIMIT N` — race condition 차단
- 처리 단위: 1 row = 1 FCM API 호출 (멀티캐스트는 동일 recipient 의 다중 토큰만)

### 5-3. 처리 로직

```
loop:
  rows = SELECT id, recipient_agent_id, trigger_kind, fake_headline_id, ...
         FROM notification_queue
         WHERE status='QUEUED' AND scheduled_at <= now()
         ORDER BY scheduled_at ASC
         LIMIT 5
         FOR UPDATE SKIP LOCKED;

  for row in rows:
    headline = SELECT headline FROM fake_headlines WHERE id=row.fake_headline_id;
    tokens = SELECT fcm_token FROM push_tokens
             WHERE agent_id=row.recipient_agent_id AND deleted_at IS NULL;

    if tokens.length == 0:
      UPDATE notification_queue SET status='FAILED', failed_reason='NO_ACTIVE_TOKEN' WHERE id=row.id;
      INSERT INTO audit_logs (kind='NOTIFICATION_FAIL', actor_kind='system', target_type='notification', target_id=row.id, context={reason:'NO_ACTIVE_TOKEN'});
      continue;

    title = composeTitle(row.trigger_kind, headline);
    // e.g. '📰 새 뉴스 — {headline}', '📰 새 뉴스 사진 — {headline}', '📰 새 뉴스 자료 — {headline}'

    try:
      await firebaseAdmin.messaging().sendEachForMulticast({
        tokens: tokens,
        notification: { title: title, body: '' },
        // data payload 절대 없음 (REQ-021 acceptance)
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } }
      });
      UPDATE notification_queue SET status='SENT', sent_at=now() WHERE id=row.id;
    catch err:
      UPDATE notification_queue SET status='FAILED', failed_reason=substring(err.code, 0, 64) WHERE id=row.id;
      INSERT INTO audit_logs (kind='NOTIFICATION_FAIL', ..., context={fcm_error: err.code});
      handleInvalidToken(err);   // err.code=='messaging/registration-token-not-registered' → push_tokens soft delete
```

### 5-4. trigger_kind → title 매핑

| trigger_kind | title 템플릿 |
|---|---|
| `MESSAGE_TEXT` | `📰 새 뉴스 — {headline}` |
| `MESSAGE_IMAGE` | `📰 새 뉴스 사진 — {headline}` |
| `MESSAGE_FILE` | `📰 새 뉴스 자료 — {headline}` |
| `PAIRING_REQUEST` | `📰 새 뉴스 — {headline}` (메시지와 동일. 외부 식별 불가) |
| `PAIRING_REJECT` | `📰 새 뉴스 — {headline}` (동일) |

본문 (`body`) 는 **빈 문자열** — title 만으로 위장 (Apple News / Yonhap 알림 패턴과 일치).

### 5-5. 무효 토큰 처리

FCM 오류 `messaging/registration-token-not-registered` 또는 `messaging/invalid-registration-token` → 해당 `push_tokens` row soft delete (`deleted_at=now()`).

### 5-6. 재시도 정책

`status='FAILED'` 된 row 는 worker 가 재시도하지 않는다. 재발송이 필요하면 새 row INSERT (새 trigger 이벤트 발생 시). 동일 메시지에 대한 자동 재시도는 v1 미적용 (사용자가 채팅을 열면 자동 동기화되므로 불필요).

### 5-7. 메트릭 / 알림

운영 모니터링 (선택, v1.1):
- `notification_queue WHERE status='QUEUED' AND scheduled_at < now() - INTERVAL '5 minutes'` count → worker 정체 알림
- 24시간 `FAILED` 비율 > 10% → Slack/email 알림

---

## 6. FCM 어댑터 사양 (infrastructure/push)

### 6-1. SDK

`firebase-admin` (Node.js). 백엔드 단독 사용. iOS APNs 는 FCM 이 자동 중계 (DECISIONS v1.2 정합).

### 6-2. 초기화

```typescript
import * as admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FCM_SERVICE_ACCOUNT_JSON)),
  projectId: FCM_PROJECT_ID
});
```

환경변수: `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON` (Docker secret 권장).

### 6-3. 인터페이스

```typescript
interface PushDispatcher {
  sendDisguised(tokens: string[], title: string): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }>;
}
```

`data` 인자 없음 — 사용 자체가 차단 (개발 시 lint rule).

### 6-4. 응답 처리

`BatchResponse` 의 `responses[i].error` 검사:
- 토큰 무효 → invalidTokens 배열에 추가
- 일시 오류 (network) → failureCount 증가 (재시도 X)

---

## 7. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| GET /notifications/preferences | "위장 푸시 수신" — 본인 push_tokens 메타 조회 | ✓ |
| POST /notifications/dry-run | (운영 / 디버깅) 본인 토큰에만 발송 — 본인 row 제한 강제 | ✓ |

worker 는 system 수행자 (permission_policy §3, 권한 검사 대상 외).

---

## 8. DB 매핑 (G4)

| 엔드포인트 / worker | 읽기 / 쓰기 |
|---|---|
| GET /notifications/preferences | R: push_tokens, notification_queue |
| POST /notifications/dry-run | R: push_tokens, fake_headlines. + FCM 즉시 호출 |
| NotificationDispatchWorker | R: notification_queue, fake_headlines, push_tokens. W: notification_queue (status), push_tokens (invalid soft delete), audit_logs |

상태 매핑:
- notification_queue.status: `QUEUED` → `SENT` (worker 성공) / `FAILED` (worker 실패)
- push_tokens: 무효 토큰 → `deleted_at` 갱신

---

## 9. 위장 / 보안 강화 사항

1. **data payload 금지 강제**: FCM 어댑터 인터페이스 자체에서 차단. 코드 리뷰 + lint rule 로 이중 방어
2. **title 만 사용**: body 는 빈 문자열 (Apple News 패턴 매칭)
3. **trigger 종류 외부 식별 차단**: PAIRING_REQUEST / PAIRING_REJECT / MESSAGE_TEXT 의 title 패턴이 유사 (`📰 새 뉴스 — `). 첨부 종류별 분기 (`사진` / `자료`) 만 외부 단서 — 카피 풀이 자연스러우면 무관
4. **jitter 0~60초**: 메시지 전송 시각 - 알림 시각의 상관관계 차단 (REQ-022)
5. **fake_headlines 시드 50개+ 한국어**: REQ-021 acceptance. seed.sql 별도 적재
6. **FCM 무효 토큰 자동 정리**: push_tokens soft delete → 다음 발송에서 제외
7. **dry-run 60초 쿨다운**: 스팸 차단
8. **dry-run 은 본인 토큰에만**: 다른 사용자 추적 / 괴롭힘 차단

---

## 10. seed.sql 권장 헤드라인 (참고 — 50개 시드)

운영 시점에 `fake_headlines` 테이블 시드 적재. 자연스러운 한국어 뉴스 카피 50개+. 예시:

```sql
INSERT INTO fake_headlines (headline, category) VALUES
('정상회담 합의 도출 — 양국 신뢰 회복 신호', 'politics'),
('AI 반도체 수요 폭증, 분기 매출 사상 최대', 'tech'),
('서울 아파트값 5주 연속 하락, 거래량은 회복세', 'economy'),
('베스트셀러 작가 신간 출간 — 출판계 화제', 'culture'),
('국가대표 축구팀, 월드컵 예선 결승 진출 확정', 'general'),
-- ... 45+ rows
;
```

v1 운영 시점에 SV / 운영자가 시드 SQL 작성·적재.

---

## 전제 / 우선순위 적용

- **사용자 endpoint 최소**: 본 도메인의 핵심은 worker / FCM 어댑터. 외부 endpoint 는 설정 동기화 + 위장 테스트만
- **data payload 완전 차단**: 코드/lint/리뷰 3중 방어
- **dry-run kind audit v1 생략**: db_design audit_logs CHECK 의 enum 에 `NOTIFICATION_DRY_RUN` 미포함 → v1.1 추가 권장
- **fake_headlines seed 운영 책임**: SV / 운영자가 50개+ 한국어 카피 직접 작성
- **PUT 미사용**
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-NOTIFICATION_
