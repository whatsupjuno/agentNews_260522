# secret_unlock API 명세서 v1.0

---

## 1. 개요

secret_unlock API 는 비밀 시퀀스의 등록 / 변경 / 분실 복구 (sequence 도메인) 와 시퀀스 검증 / 세션 유지 / 명시 종료 (unlock 도메인) 를 담당한다.

본 도메인은 라우트별로 응답 모드가 분리된다 (dev_conventions §4-4):

| 라우트군 | 응답 모드 | 사유 |
|---|---|---|
| `/api/v1/sequence/*` | 일반 | 설정 화면 전용 (앱 내부) |
| `/api/v1/unlock/attempt` | **위장 강화** (특수 처리) | 외부 노출. 실패 시 정상 200 + 가짜 기사 상세 |
| `/api/v1/unlock/ping`, `/unlock/revoke` | 위장 | 외부 노출 가능 |

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | JWT access token (sequence/unlock 공통). reset-complete 만 reset_token 별도 |

**공통 규칙**:
- 시퀀스 평문 저장 금지 — HMAC-SHA256 + 16B salt (SEC-009)
- 시퀀스 길이 4~6 (REQ-006)
- unlock_token 30분 (REQ-007). `X-Unlock-Token` 헤더 사용 (SEC-003)
- 시퀀스 검증 실패 카운터 무한 — 1초 내 동일 article 재탭 무시 rate-limit 만 (intake G-1)
- 1 agent = 1 ACTIVE unlock_session (db_design §4-4 partial UQ)
- 모든 mutating 요청에 `Idempotency-Key` 헤더 (단 `/unlock/attempt` 는 본질적으로 멱등하지 않으므로 Idempotency-Key 미적용 — 명시 예외)

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 | 응답 모드 |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/sequence` | 시퀀스 최초 등록 | access | 일반 |
| 2 | PATCH | `/api/v1/sequence` | 시퀀스 변경 (현재 시퀀스 재인증) | access | 일반 |
| 3 | POST | `/api/v1/sequence/reset-request` | 분실 복구 reset 링크 발송 | access | 일반 |
| 4 | POST | `/api/v1/sequence/reset-complete` | reset 토큰 + 새 시퀀스로 재등록 | reset_token | 일반 |
| 5 | POST | `/api/v1/unlock/attempt` | 시퀀스 입력 검증 (위장 특수 처리) | access | **위장 특수** |
| 6 | POST | `/api/v1/unlock/ping` | 백그라운드 5초 감지 ping | access + unlock | 위장 |
| 7 | POST | `/api/v1/unlock/revoke` | unlock 세션 명시 종료 (앱 재시작/로그아웃 동반) | access + unlock | 위장 |

---

## 3. 공통 응답 포맷

development_conventions §4-2 (일반) / §4-3 (위장) 분기. `/unlock/attempt` 는 §4 의 특수 처리 참조.

---

## 4. 엔드포인트 상세

### 4-1. 시퀀스 최초 등록

**메서드 + URL**: `POST /api/v1/sequence`

**설명**: 가입 직후 `NOT_REGISTERED` 상태의 에이전트가 비밀 시퀀스를 등록한다 (REQ-006). 배열은 뉴스 피드 노출 순서 인덱스 4~6개.

**인증**: 필요 (`Authorization: Bearer <access>`)

**권한**: 본인 agent_secret_sequences row (permission_policy §4-1-1)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "sequence": [5, 3, 1, 7] }
```

**검증**:
- `sequence`: int[]. 길이 4~6. 각 원소 1~50 (뉴스 피드 size 범위)
- 중복 허용 (예: [3, 3, 5, 1])

**처리 흐름**:
1. JwtAuthGuard
2. 입력 검증
3. `agent_secret_sequences WHERE agent_id=? FOR UPDATE` (트랜잭션 + 행 잠금)
4. row.status ≠ `NOT_REGISTERED` → `SEQUENCE_ALREADY_REGISTERED` (변경은 4-2 사용)
5. salt 16B 랜덤 생성 (`crypto.randomBytes(16)`)
6. hash = HMAC-SHA256(`SEQUENCE_HMAC_KEY`, salt || JSON.stringify(sequence))
7. `UPDATE agent_secret_sequences SET status='REGISTERED', sequence_length=?, hash=?, salt=?, registered_at=now()`
8. `INSERT INTO audit_logs (kind='SEQUENCE_REGISTER', actor_agent_id=?, actor_kind='agent', target_type='agent_secret_sequences', target_id=?)`
9. 트랜잭션 commit
10. 응답

**응답 (201 Created)**:
```json
{
  "success": true,
  "data": {
    "sequenceStatus": "REGISTERED",
    "registeredAt": "2026-05-20T10:00:00.000Z",
    "sequenceLength": 4
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

응답에 시퀀스 원본 배열 미포함 (등록 직후 1회 확인 화면은 클라이언트가 로컬 보관. 서버 응답에는 평문 미포함 — SEC-009).

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `SEQUENCE_VALIDATION_ERROR` | 400 | 길이 / 원소 범위 위반 |
| `SEQUENCE_ALREADY_REGISTERED` | 409 | 이미 등록됨. 변경은 PATCH |
| `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_CONFLICT` | 400 / 409 | - |

**부수효과**:
- agent_secret_sequences 상태 전이 (`NOT_REGISTERED` → `REGISTERED`)
- audit_logs: `SEQUENCE_REGISTER`

---

### 4-2. 시퀀스 변경

**메서드 + URL**: `PATCH /api/v1/sequence`

**설명**: 현재 시퀀스를 재인증한 뒤 새 시퀀스로 교체한다 (REQ-006). 변경 = 동일 row UPDATE.

**인증**: 필요

**권한**: 본인 row 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "currentSequence": [5, 3, 1, 7], "newSequence": [4, 2, 6, 8] }
```

**처리 흐름**:
1. JwtAuthGuard
2. 입력 검증
3. `agent_secret_sequences WHERE agent_id=? FOR UPDATE`
4. row.status ≠ `REGISTERED` → `SEQUENCE_NOT_REGISTERED`
5. 현재 시퀀스 검증: HMAC-SHA256(salt || currentSequence) == row.hash → 실패 시 `SEQUENCE_VERIFY_REQUIRED`
6. 신규 salt + hash 생성
7. `UPDATE agent_secret_sequences SET hash=?, salt=?, sequence_length=?, registered_at=now()` (status 유지)
8. `INSERT INTO audit_logs (kind='SEQUENCE_CHANGE', ...)`
9. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "sequenceStatus": "REGISTERED", "changedAt": "...", "sequenceLength": 4 },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `SEQUENCE_VALIDATION_ERROR` | 400 | currentSequence / newSequence 형식 위반 |
| `SEQUENCE_NOT_REGISTERED` | 409 | row.status='NOT_REGISTERED' 또는 'RESET_PENDING' |
| `SEQUENCE_VERIFY_REQUIRED` | 401 | currentSequence 불일치 |
| `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_CONFLICT` | 400 / 409 | - |

**부수효과**:
- agent_secret_sequences hash/salt/sequence_length 갱신
- audit_logs: `SEQUENCE_CHANGE`

---

### 4-3. reset 링크 발송

**메서드 + URL**: `POST /api/v1/sequence/reset-request`

**설명**: 시퀀스를 기억 못 하는 에이전트가 본인 이메일로 reset 링크를 요청한다. status `REGISTERED` → `RESET_PENDING`. 링크 30분 유효 (REQ-008).

**인증**: 필요 (access token. 별도 비밀번호 재확인은 v1 미적용 — 분실 사용자는 이미 로그인 상태)

**권한**: 본인 row 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard
2. `agent_secret_sequences WHERE agent_id=? FOR UPDATE`
3. row.status ≠ `REGISTERED` → `SEQUENCE_NOT_REGISTERED`
4. plaintext reset_token 생성 (`crypto.randomBytes(32).toString('base64url')`)
5. token_hash = HMAC-SHA256(SEQUENCE_HMAC_KEY, plaintext)
6. 트랜잭션:
   - `INSERT INTO sequence_reset_tokens (agent_id, token_hash, expires_at=now()+'30 min')`
   - `UPDATE agent_secret_sequences SET status='RESET_PENDING', reset_requested_at=now()`
   - `INSERT INTO audit_logs (kind='SEQUENCE_RESET_REQUEST', ...)`
7. commit 후 비동기 worker 로 이메일 발송 큐잉. URL = `https://app.example.com/reset?token=<plaintext>`
8. 응답 — 토큰은 응답 본문에 미포함

**응답 (202 Accepted)**:
```json
{
  "success": true,
  "data": { "sequenceStatus": "RESET_PENDING", "linkExpiresAt": "..." },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `SEQUENCE_NOT_REGISTERED` | 409 | row.status ≠ REGISTERED |
| `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_CONFLICT` | 400 / 409 | - |

**부수효과**:
- sequence_reset_tokens INSERT
- agent_secret_sequences `REGISTERED` → `RESET_PENDING`
- audit_logs: `SEQUENCE_RESET_REQUEST`
- 이메일 발송 (commit 후 worker)

---

### 4-4. reset 완료

**메서드 + URL**: `POST /api/v1/sequence/reset-complete`

**설명**: 이메일로 받은 plaintext reset_token + 새 시퀀스로 재등록한다. status `RESET_PENDING` → `REGISTERED`.

**인증**: reset_token (access 불필요 — 분실 사용자가 access 도 잃은 경우 대비)

**권한**: reset_token 보유자 (토큰 자체가 agent_id 매핑)

**Request Headers**:
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "resetToken": "plaintext-base64url", "newSequence": [9, 1, 4, 2] }
```

**처리 흐름**:
1. 입력 검증
2. token_hash = HMAC-SHA256(SEQUENCE_HMAC_KEY, resetToken)
3. `sequence_reset_tokens WHERE token_hash=? AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`
4. 미존재 / 만료 / 이미 사용됨 → `SEQUENCE_RESET_LINK_EXPIRED`
5. agent_id 추출
6. 트랜잭션:
   - `UPDATE sequence_reset_tokens SET consumed_at=now() WHERE id=?`
   - 새 salt + hash 생성
   - `UPDATE agent_secret_sequences SET status='REGISTERED', hash=?, salt=?, sequence_length=?, registered_at=now()`
   - `INSERT INTO audit_logs (kind='SEQUENCE_RESET_COMPLETE', ...)`
7. 응답 (access/refresh 재발급 안 함 — 사용자 권장 흐름은 재로그인)

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "sequenceStatus": "REGISTERED" },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `SEQUENCE_VALIDATION_ERROR` | 400 | newSequence 형식 위반 |
| `SEQUENCE_RESET_LINK_EXPIRED` | 401 | 토큰 미존재 / 만료 / 사용됨 |
| `IDEMPOTENCY_KEY_MISSING` / `IDEMPOTENCY_KEY_CONFLICT` | 400 / 409 | - |

**부수효과**:
- sequence_reset_tokens.consumed_at 갱신
- agent_secret_sequences `RESET_PENDING` → `REGISTERED` (새 hash)
- audit_logs: `SEQUENCE_RESET_COMPLETE`

---

### 4-5. 시퀀스 입력 검증 (위장 특수 처리)

**메서드 + URL**: `POST /api/v1/unlock/attempt`

**설명**: 모바일이 사용자의 기사 탭 시퀀스를 모아서 검증 요청한다. **이 endpoint 는 위장 강화 핵심** — 실패 / 미등록 / 잘못된 시퀀스 / 만료된 검증 모두 **HTTP 200 + 가짜 기사 상세** 로 응답. 성공 시에만 응답에 `unlockToken` 포함 (REQ-007, REQ-009).

**인증**: 필요 (`Authorization: Bearer <access>`)

**권한**: agent (permission_policy §4-1-2, "시퀀스 검증 unlock")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- Idempotency-Key 미적용 (시퀀스 시도는 본질적으로 비-멱등)

**Request Body**:
```json
{
  "batchId": "uuid (현재 보고 있는 news batch — 5-3-1-7 의 displayOrder 가 동일 batch 안에서 유효)",
  "attempt": [5, 3, 1, 7]
}
```

**처리 흐름**:
1. JwtAuthGuard. **실패 시 401 그대로** (앱이 token 재발급 시도)
2. 입력 검증 — 형식 위반 시 위장 응답 (200 + 가짜 기사) — sniffer 가 status code 로 식별 불가
3. rate limit: agent_id 별 1초 내 동일 attempt 무시 (서버 Redis or in-memory). 캐시된 응답 그대로 재전송 (위장 일관성)
4. batchId 가 현재 활성 캐시인지 검증 (`news_articles_cache WHERE batch_id=?` 존재). 미존재 시 위장 응답 (실패 처리)
5. `agent_secret_sequences WHERE agent_id=?`
6. row.status ≠ `REGISTERED` 또는 attempt 길이 ≠ row.sequence_length → 위장 응답 (실패)
7. computed_hash = HMAC-SHA256(SEQUENCE_HMAC_KEY, row.salt || JSON.stringify(attempt))
8. computed_hash ≠ row.hash → 위장 응답 (실패) + `INSERT INTO audit_logs (kind='UNLOCK_FAIL', actor_agent_id=?, context={attempt_length, batch_id})`
9. 일치 시:
   - 기존 ACTIVE unlock_session 이 있으면 `UPDATE status='REVOKED', revoked_reason='NEW_UNLOCK'`
   - 신규 `INSERT INTO unlock_sessions (agent_id, token_jti, status='ACTIVE', expires_at=now()+'30 min')` RETURNING token_jti
   - unlock_token JWT 발급 (jti = token_jti, type='unlock')
   - `INSERT INTO audit_logs (kind='UNLOCK_SUCCESS', ...)`
10. 응답 (성공/실패 분기)

**응답 (200 OK) — 성공**:
```json
{
  "success": true,
  "data": {
    "unlocked": true,
    "unlockToken": "eyJhbGc...",
    "expiresAt": "2026-05-20T10:30:00.000Z"
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**응답 (200 OK) — 실패 (위장 / 외부 식별 불가)**:
```json
{
  "success": true,
  "data": {
    "article": {
      "articleId": "base64url (방금 시퀀스 시도의 마지막 article)",
      "displayOrder": 7,
      "title": "...",
      "summary": "...",
      "url": "...",
      "thumbnailUrl": "...",
      "source": "...",
      "publishedAt": "..."
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**중요**: 실패 응답의 본문은 `/news/articles/:articleId` 의 성공 응답과 **외부에서 식별 불가능한 구조** — 실패 시에도 `success: true` 유지. 클라이언트는 `data.unlocked` 또는 `data.unlockToken` 필드 존재 여부로만 성공·실패 분기 (외부 sniffer 는 단순 기사 상세 응답으로 봄).

**에러 (HTTP non-200 — 위장 깨짐 우려 있으므로 최소화)**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | access 만료 (Guard 단계 — 모바일은 refresh 후 재시도) |
| `AUTH_TOKEN_INVALID` | 401 | 토큰 형식 위반 |
| `INTERNAL_ERROR` | 500 | DB / crypto 오류 (운영 알람) |

**부수효과**:
- 성공: unlock_sessions ACTIVE row 신규 (+ 기존 REVOKED), audit_logs `UNLOCK_SUCCESS`
- 실패: audit_logs `UNLOCK_FAIL` (외부 응답은 동일한 위장 본문, 내부 audit 만 사실 기록)
- rate-limit Redis 키 갱신

---

### 4-6. unlock 백그라운드 ping

**메서드 + URL**: `POST /api/v1/unlock/ping`

**설명**: 채팅 화면이 foreground 인 동안 모바일이 5초 미만 간격으로 호출한다. last_seen_at 갱신. 5초 이상 ping 없는 ACTIVE 세션은 별도 worker 가 REVOKED 처리 (`revoked_reason='BACKGROUND'`, REQ-023).

**인증**: 필요 (access + unlock)

**권한**: 본인 unlock_session 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock_token>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard (access)
2. UnlockTokenGuard (unlock_token, jti 검증 + DB row status='ACTIVE' 검증)
3. `UPDATE unlock_sessions SET last_seen_at=now() WHERE token_jti=? AND status='ACTIVE'`
4. 0 rows → 위장 404
5. 응답 (위장 형식 안의 success)

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "alive": true, "expiresAt": "..." },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | access 단계 |
| `NEWS_ARTICLE_NOT_FOUND` | 404 | unlock_token 만료/REVOKED, 또는 jti 불일치, 다른 agent (위장) |

**부수효과**:
- unlock_sessions.last_seen_at 갱신
- audit 미기록 (빈번 호출)

---

### 4-7. unlock 명시 종료

**메서드 + URL**: `POST /api/v1/unlock/revoke`

**설명**: 모바일이 명시적으로 unlock 세션을 종료한다. 시나리오: 앱 재시작 시 백그라운드 ping 누락 / 로그아웃 동반 / 페어 해제 트리거 (REQ-024).

**인증**: 필요 (access + unlock)

**권한**: 본인 unlock_session 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock_token>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "reason": "APP_RESTART" }
```

**검증**: `reason ∈ {APP_RESTART, LOGOUT, MANUAL}` (db_design §4-4 의 revoked_reason CHECK 와 일치하는 일부. BACKGROUND / PAIR_DISCONNECT / NEW_UNLOCK 은 서버 트리거 전용)

**처리 흐름**:
1. JwtAuthGuard + UnlockTokenGuard
2. 트랜잭션:
   - `UPDATE unlock_sessions SET status='REVOKED', revoked_reason=? WHERE token_jti=? AND status='ACTIVE'`
   - 0 rows → 위장 404
   - `INSERT INTO audit_logs (kind='UNLOCK_REVOKE', context={reason})`
3. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "revoked": true },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `UNLOCK_VALIDATION_ERROR` | 400 | reason 값 위반 (위장 적용 안 함 — body 검증) |
| `NEWS_ARTICLE_NOT_FOUND` | 404 | unlock 세션 미존재 / 이미 종료 (위장) |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |

**부수효과**:
- unlock_sessions `ACTIVE` → `REVOKED`
- audit_logs: `UNLOCK_REVOKE`

---

## 5. unlock_token JWT 클레임

```json
{
  "sub": "agent_external_id",
  "agentId": "internal bigint",
  "jti": "unlock_sessions.token_jti",
  "iat": ...,
  "exp": ...,
  "type": "unlock"
}
```

서명 키: `JWT_UNLOCK_SECRET` 환경 변수 (access/refresh 와 분리 — dev_conventions §10).

**검증 (UnlockTokenGuard)**:
1. JWT 서명·만료 검증
2. jti → `unlock_sessions WHERE token_jti=? AND status='ACTIVE'` 조회
3. agent_id 일치 검증 (`req.user.agentId` 와 `unlock_sessions.agent_id`)
4. last_seen_at 5초 초과 → DB 트리거가 아닌 worker 가 REVOKED 처리하므로, Guard 가 잡는 경우는 worker race 직후만

---

## 6. 백그라운드 worker (5초 ping 누락 처리)

별도 worker (`UnlockBackgroundExpireWorker`) 가 1초 주기로 다음 실행:

```sql
UPDATE unlock_sessions
SET status='REVOKED', revoked_reason='BACKGROUND'
WHERE status='ACTIVE'
  AND last_seen_at < now() - INTERVAL '5 seconds'
RETURNING id, agent_id;
-- 결과별로:
INSERT INTO audit_logs (kind='UNLOCK_BACKGROUND', actor_agent_id=?, actor_kind='system', target_type='unlock_session', target_id=?);
```

이 worker 는 API 가 아니지만 본 도메인의 라이프사이클 핵심이라 본 문서에 명시.

---

## 7. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| POST /sequence | 시퀀스 등록 (최초) | ✓ |
| PATCH /sequence | 시퀀스 변경 | ✓ |
| POST /sequence/reset-request | 시퀀스 reset 요청 | ✓ |
| POST /sequence/reset-complete | 시퀀스 reset 완료 | ✓ |
| POST /unlock/attempt | 시퀀스 검증 (unlock) | ✓ |
| POST /unlock/ping | unlock_sessions UPDATE — 본인 row | ✓ |
| POST /unlock/revoke | unlock_sessions REVOKE — 본인 row | ✓ |

---

## 8. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 |
|---|---|
| POST /sequence | W: agent_secret_sequences, audit_logs |
| PATCH /sequence | R/W: agent_secret_sequences (verify + update), audit_logs |
| POST /sequence/reset-request | W: sequence_reset_tokens, agent_secret_sequences, audit_logs |
| POST /sequence/reset-complete | R/W: sequence_reset_tokens, agent_secret_sequences, audit_logs |
| POST /unlock/attempt | R: agent_secret_sequences, news_articles_cache. W: unlock_sessions, audit_logs |
| POST /unlock/ping | W: unlock_sessions (last_seen_at) |
| POST /unlock/revoke | W: unlock_sessions, audit_logs |

컬럼은 db_design §4-2, §4-3, §4-4, §4-12 정의 따름.

---

## 9. 위장 / 보안 강화 사항

1. **/unlock/attempt 실패도 HTTP 200**: 외부 sniffer 가 status code 로 식별 불가. 응답 본문도 정상 기사 상세와 외부 식별 불가
2. **rate limit cache 일관성**: 동일 attempt 1초 내 재시도 시 캐시된 동일 응답 반환 (status 변경 회피)
3. **시퀀스 평문 비교 금지**: 항상 HMAC-SHA256 + 상수시간 비교 (`crypto.timingSafeEqual`)
4. **HMAC 키 분리**: SEQUENCE_HMAC_KEY 와 JWT_*_SECRET 환경변수 모두 다름
5. **LOCKED_OUT 미도입**: PLAN-003 intake G-1 우선 (rate-limit-only)
6. **unlock_token JWT_UNLOCK_SECRET 분리**: access/refresh 키와 다른 시크릿 → 토큰 종류 혼동 방지
7. **백그라운드 5초 강제**: 클라이언트 신뢰 X — 서버측 last_seen_at + worker
8. **NEW_UNLOCK 자동 REVOKE**: 다중 디바이스 동시 unlock 차단
9. **reset 링크 token_hash 만 DB 저장**: plaintext 는 이메일로만 1회 전송 후 폐기

---

## 전제 / 우선순위 적용

- **응답 모드 분리**: sequence/* 일반, unlock/* 위장 (dev_conventions §4-4 정합)
- **unlock/attempt 의 위장 특수**: 실패에도 HTTP 200 + 가짜 기사 본문 — 외부 식별 차단
- **LOCKED_OUT 미도입**: intake G-1 우선
- **Idempotency-Key 예외**: /unlock/attempt 만 미적용 (시도 자체가 비-멱등)
- **PUT 미사용**: 변경은 PATCH
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-SECRET_UNLOCK_
