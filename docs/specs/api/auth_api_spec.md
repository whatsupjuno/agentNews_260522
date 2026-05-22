# auth API 명세서 v1.0

---

## 1. 개요

auth API 는 에이전트 회원가입 / 로그인 / 로그아웃 / 토큰 재발급을 담당한다. 본 도메인의 엔드포인트는 **앱 내부 화면 전용** 이므로 위장 응답 (`404 NEWS_ARTICLE_NOT_FOUND`) 을 사용하지 않고 일반 응답 포맷 (development_conventions §4-2) 을 따른다.

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | 이메일+비밀번호 → JWT (access 15분 + refresh 30일) |

**공통 규칙**:
- `Authorization: Bearer <access>` 헤더로 인증된 요청 식별
- 토큰 재발급은 `X-Refresh-Token` 헤더 사용 (httpOnly cookie 금지 — SEC-003)
- access token 유효기간 = 15분, refresh token = 30일
- bcrypt cost 12 비밀번호 해싱 (SEC-001)
- 비밀번호는 평문 노출 금지 (요청은 HTTPS, DB 는 password_hash 컬럼만)
- 모든 mutating 요청은 `Idempotency-Key` 헤더 (SEC-008)
- 응답 포맷: development_conventions §4-2 (일반 응답)

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 |
|---|---|---|---|---|
| 1 | POST | `/api/v1/auth/signup` | 이메일+비밀번호 회원가입 | - |
| 2 | POST | `/api/v1/auth/login` | 로그인 (access + refresh 발급) | - |
| 3 | POST | `/api/v1/auth/logout` | 로그아웃 (refresh 무효화) | 필요 |
| 4 | POST | `/api/v1/auth/refresh` | access token 재발급 | refresh |
| 5 | POST | `/api/v1/auth/push-token` | FCM 디바이스 토큰 등록·갱신 | 필요 |
| 6 | DELETE | `/api/v1/auth/push-token` | FCM 토큰 해제 (로그아웃 외 별도 호출 가능) | 필요 |

---

## 3. 공통 응답 포맷

development_conventions.md §4-2 (일반 응답) 사용. 위장 응답 (§4-3) 미사용.

**성공**:
```json
{
  "success": true,
  "data": { /* 페이로드 */ },
  "meta": { "timestamp": "2026-05-19T12:00:00.000Z", "traceId": "uuid" }
}
```

**실패**:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "사람이 읽을 메시지",
    "details": { "field": "email" },
    "traceId": "uuid"
  },
  "meta": { "timestamp": "..." }
}
```

---

## 4. 엔드포인트 상세

### 4-1. 회원가입

**메서드 + URL**: `POST /api/v1/auth/signup`

**설명**: 이메일+비밀번호로 에이전트 계정을 생성한다. 가입 직후 access + refresh 토큰을 발급하여 즉시 로그인 상태로 진입한다 (REQ-001).

**인증**: 불필요

**권한**: 누구나 (permission_policy §4-1-2, "회원가입" 액션)

**Request Headers**:
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{
  "email": "agent@example.com",
  "password": "raw_password_min_8_chars",
  "nickname": "에이전트01"
}
```

**검증 규칙**:
- `email`: RFC 5322 형식. 소문자 정규화 후 저장. 최대 255자
- `password`: 8자 이상 64자 이하. 영문 + 숫자 포함
- `nickname`: 1~40자. 공백 trim. 중복 허용 (페어링 검색은 external_id 기반)

**처리 흐름**:
1. 입력 검증 (class-validator)
2. 이메일 정규화 후 활성 row 중복 검사 — `agents WHERE email=? AND deleted_at IS NULL`
3. 트랜잭션 시작
4. bcrypt cost 12 로 password_hash 생성
5. `INSERT INTO agents (...) VALUES (...) RETURNING id, external_id`
6. `INSERT INTO agent_secret_sequences (agent_id, status) VALUES (?, 'NOT_REGISTERED')`
7. JWT access (15분) + refresh (30일) 발급 → `refresh_tokens` row 저장
8. `INSERT INTO audit_logs (kind='USER_SIGNUP', actor_agent_id=신규 id, actor_kind='agent', ...)`
9. 트랜잭션 commit
10. 응답

**응답 (201 Created)**:
```json
{
  "success": true,
  "data": {
    "agent": {
      "externalId": "550e8400-e29b-41d4-a716-446655440000",
      "email": "agent@example.com",
      "nickname": "에이전트01",
      "sequenceStatus": "NOT_REGISTERED"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "accessExpiresAt": "2026-05-19T12:15:00.000Z",
      "refreshToken": "eyJhbGc...",
      "refreshExpiresAt": "2026-06-18T12:00:00.000Z"
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_VALIDATION_ERROR` | 400 | 이메일 형식 / 비밀번호 길이 / nickname 길이 위반 |
| `AUTH_EMAIL_DUPLICATE` | 409 | 활성 agents row 중 동일 이메일 존재 |
| `IDEMPOTENCY_KEY_MISSING` | 400 | Idempotency-Key 헤더 누락 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 동일 키 + 다른 request_hash |
| `INTERNAL_ERROR` | 500 | DB / 외부 시스템 오류 |

**부수효과**:
- audit_logs: `kind='USER_SIGNUP'`, `actor_agent_id=신규 id`, `actor_kind='agent'`
- refresh_tokens row 1건 생성
- agent_secret_sequences row 1건 (`NOT_REGISTERED`) 생성

---

### 4-2. 로그인

**메서드 + URL**: `POST /api/v1/auth/login`

**설명**: 에이전트가 이메일+비밀번호로 로그인하여 access + refresh 토큰을 발급받는다 (REQ-002).

**인증**: 불필요

**권한**: 누구나 (permission_policy §4-1-2, "로그인" 액션)

**Request Headers**:
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{
  "email": "agent@example.com",
  "password": "raw_password"
}
```

**처리 흐름**:
1. 입력 검증
2. 이메일 정규화 후 `agents WHERE email=? AND deleted_at IS NULL AND status='ACTIVE'` 조회
3. 못 찾으면 bcrypt timing-equalization 더미 비교 후 `AUTH_INVALID_CREDENTIALS` 반환 (사용자 열거 차단)
4. bcrypt compare(password, password_hash) — 실패 시 `AUTH_INVALID_CREDENTIALS`
5. access + refresh JWT 발급
6. 트랜잭션: `INSERT INTO refresh_tokens (...) RETURNING id`
7. `INSERT INTO audit_logs (kind='LOGIN_SUCCESS', actor_agent_id=?, actor_kind='agent', ip_address=?, user_agent=?)`
8. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "agent": {
      "externalId": "uuid",
      "email": "agent@example.com",
      "nickname": "에이전트01",
      "sequenceStatus": "REGISTERED"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "accessExpiresAt": "...",
      "refreshToken": "eyJhbGc...",
      "refreshExpiresAt": "..."
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_VALIDATION_ERROR` | 400 | 이메일/비밀번호 형식 위반 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 이메일 미존재 또는 비밀번호 불일치 (구분 안 함) |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | - |
| `INTERNAL_ERROR` | 500 | - |

**부수효과**:
- 성공: audit_logs `kind='LOGIN_SUCCESS'` + refresh_tokens row 신규
- 실패: audit_logs `kind='LOGIN_FAIL'`, `actor_agent_id` 는 row 존재 시만 (그 외 NULL), `context.email` 기록

---

### 4-3. 로그아웃

**메서드 + URL**: `POST /api/v1/auth/logout`

**설명**: 현재 세션의 refresh token 을 무효화하고 모바일 측 keychain 토큰 삭제 안내를 응답한다 (REQ-003).

**인증**: 필요 (`Authorization: Bearer <access>`)

**권한**: 본인 토큰만 (permission_policy §4-1-2, "로그아웃" 액션)

**Request Headers**:
- `Authorization: Bearer <access_token>` (필수)
- `X-Refresh-Token: <refresh_token>` (필수, 무효화 대상 식별)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard 가 access 검증 → `req.user.agentId`
2. refresh JWT 의 jti 추출 → `refresh_tokens` row 조회 (`token_jti=?, agent_id=req.user.agentId, revoked_at IS NULL`)
3. 없거나 다른 agent 의 토큰이면 `AUTH_REFRESH_NOT_FOUND` (위장 불필요 — 앱 내부)
4. 트랜잭션: `UPDATE refresh_tokens SET revoked_at=now() WHERE id=?`
5. 해당 agent 의 모든 `unlock_sessions WHERE status='ACTIVE'` → REVOKED (`revoked_reason='LOGOUT'`)
6. 해당 agent 의 모든 `push_tokens` → soft delete (`deleted_at=now()`)
7. `INSERT INTO audit_logs (kind='UNLOCK_REVOKE', ...)` (unlock 이 있던 경우)
8. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "loggedOut": true },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | access token 만료 |
| `AUTH_TOKEN_INVALID` | 401 | access token 형식 / 서명 위반 |
| `AUTH_REFRESH_NOT_FOUND` | 401 | refresh token 미존재 / 이미 무효화됨 / 다른 agent |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |

**부수효과**:
- refresh_tokens.revoked_at 갱신
- unlock_sessions ACTIVE → REVOKED (해당 시)
- push_tokens soft delete
- audit_logs: `UNLOCK_REVOKE` (해당 시)

---

### 4-4. Access token 재발급

**메서드 + URL**: `POST /api/v1/auth/refresh`

**설명**: refresh token 으로 새 access token (및 회전된 refresh token) 을 발급받는다. rotation 정책: 매 재발급 시 기존 refresh 는 revoked 처리하고 새 refresh 발급 (재사용 공격 차단).

**인증**: refresh token 만 (access 불필요)

**권한**: 본인 refresh token 보유자

**Request Headers**:
- `X-Refresh-Token: <refresh_token>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. refresh JWT 서명·만료 검증 → jti, agent_id 추출
2. `refresh_tokens` row 조회 — `token_jti=?, agent_id=?, revoked_at IS NULL, expires_at > now()`
3. 없으면 `AUTH_REFRESH_NOT_FOUND`. 이미 revoked 면 `AUTH_REFRESH_REVOKED` (재사용 공격 의심 — 해당 agent 의 모든 refresh 무효화 권장, audit_logs `kind='LOGIN_FAIL'` 기록)
4. 트랜잭션:
   - 기존 refresh `revoked_at=now()`
   - 신규 refresh_tokens row INSERT
5. 새 access + 새 refresh JWT 발급
6. 응답 (audit_logs 별도 기록 안 함 — 빈번한 재발급)

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGc...",
      "accessExpiresAt": "...",
      "refreshToken": "eyJhbGc...",
      "refreshExpiresAt": "..."
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_INVALID` | 401 | refresh 형식 / 서명 위반 |
| `AUTH_TOKEN_EXPIRED` | 401 | refresh 만료 |
| `AUTH_REFRESH_NOT_FOUND` | 401 | DB 에 row 없음 |
| `AUTH_REFRESH_REVOKED` | 401 | 이미 revoked. 재사용 공격 가능성. 동일 agent 의 모든 refresh 무효화 |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |

**부수효과**:
- refresh_tokens: 기존 revoke + 신규 INSERT
- 재사용 의심 시 해당 agent 의 모든 refresh `revoked_at=now()`, audit_logs `kind='LOGIN_FAIL'` + `context.reason='REFRESH_REUSE'`

---

### 4-5. FCM 푸시 토큰 등록·갱신

**메서드 + URL**: `POST /api/v1/auth/push-token`

**설명**: 모바일 앱이 FCM 으로부터 받은 디바이스 토큰을 백엔드에 등록한다. 같은 fcm_token 이 이미 존재하면 last_seen_at 만 갱신 (upsert).

**인증**: 필요

**권한**: 본인 agent_id 의 push_tokens row 만 (permission_policy §4-1-1)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{
  "fcmToken": "fcm-registration-token-string",
  "platform": "ios"
}
```

**검증 규칙**:
- `fcmToken`: 1~512자
- `platform`: `'ios'` 또는 `'android'` (CHECK)

**처리 흐름**:
1. JwtAuthGuard
2. 입력 검증
3. 트랜잭션:
   - 활성 row 조회: `push_tokens WHERE fcm_token=? AND deleted_at IS NULL`
   - 있고 본인 agent_id 면 `UPDATE last_seen_at=now()`
   - 있고 다른 agent_id 면 그쪽 soft delete + 신규 INSERT (디바이스 인계 케이스)
   - 없으면 신규 INSERT
4. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "registered": true, "platform": "ios" },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `AUTH_VALIDATION_ERROR` | 400 | fcmToken / platform 형식 위반 |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |

**부수효과**:
- push_tokens upsert
- audit_logs 미기록 (빈번한 갱신)

---

### 4-6. FCM 푸시 토큰 해제

**메서드 + URL**: `DELETE /api/v1/auth/push-token`

**설명**: 현재 기기의 FCM 토큰을 명시적으로 해제한다 (디바이스 권한 거부 등).

**인증**: 필요

**권한**: 본인 토큰만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "fcmToken": "fcm-registration-token-string" }
```

**처리 흐름**:
1. JwtAuthGuard
2. `push_tokens WHERE fcm_token=? AND agent_id=req.user.agentId AND deleted_at IS NULL` 조회
3. 없으면 idempotent 성공 응답 (다중 호출 안전)
4. 있으면 `UPDATE deleted_at=now()`
5. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "removed": true },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `AUTH_VALIDATION_ERROR` | 400 | fcmToken 형식 위반 |

**부수효과**:
- push_tokens soft delete (해당 row 만)

---

## 5. 공통 인증 / 보안 사항

### 5-1. JWT 클레임 표준

**access token**:
```json
{
  "sub": "agent_external_id (uuid)",
  "agentId": "internal bigint (서버 검증용)",
  "iat": 1684500000,
  "exp": 1684500900,
  "type": "access"
}
```

**refresh token**:
```json
{
  "sub": "agent_external_id (uuid)",
  "agentId": "internal bigint",
  "jti": "refresh_tokens.token_jti (uuid)",
  "iat": ...,
  "exp": ...,
  "type": "refresh"
}
```

서명 키: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 분리 (dev_conventions §10).

### 5-2. 토큰 저장

- 모바일: react-native-keychain (SEC-003). httpOnly cookie 금지
- 서버: refresh 만 DB row 보관 (`refresh_tokens.token_jti`). access 는 stateless

### 5-3. 사용자 열거 차단

로그인 실패 시 `email 미존재` 와 `password 불일치` 를 구분하지 않는다 (`AUTH_INVALID_CREDENTIALS` 통일). bcrypt timing-equalization 더미 비교 수행.

### 5-4. 위장 응답 미적용 사유

auth 도메인의 응답은 모두 앱 *내부* 화면 (로그인 / 가입 / 설정) 에서만 표시된다. 외부에서 호출되어 위장이 깨질 가능성이 있는 도메인 (chat, pairing, attachment) 과 달리 일반 응답 포맷을 사용한다. 단, 라우트 자체는 외부 노출되므로 향후 위장 강화 필요 시 별도 결정.

---

## 6. 권한 정합 (G3)

본 명세의 모든 엔드포인트 권한은 permission_policy.md §4-1-2 의 "회원가입 / 로그인 / 로그아웃" 액션 row 와 일치한다.

| 엔드포인트 | permission_policy 액션 | 사용자 유형 | 일치 |
|---|---|---|---|
| POST /auth/signup | 회원가입 | (누구나) | ✓ |
| POST /auth/login | 로그인 | (누구나) | ✓ |
| POST /auth/logout | 로그아웃 | agent (본인) | ✓ |
| POST /auth/refresh | 로그인 (재발급) | agent (본인 refresh) | ✓ |
| POST /auth/push-token | (push_tokens CRUD) | agent (본인 row) | ✓ |
| DELETE /auth/push-token | (push_tokens CRUD) | agent (본인 row) | ✓ |

---

## 7. DB 매핑 (G4)

| 엔드포인트 | 쓰기 대상 테이블 |
|---|---|
| POST /auth/signup | agents, agent_secret_sequences, refresh_tokens, audit_logs |
| POST /auth/login | refresh_tokens, audit_logs |
| POST /auth/logout | refresh_tokens (revoke), unlock_sessions, push_tokens, audit_logs |
| POST /auth/refresh | refresh_tokens (revoke + insert), audit_logs (실패 시) |
| POST /auth/push-token | push_tokens |
| DELETE /auth/push-token | push_tokens (soft delete) |

모든 컬럼은 db_design §4-1 ~ §4-6 의 정의를 따른다.

---

## 전제 / 우선순위 적용

- **단일 사용자 유형**: agent. admin/anonymous 엔드포인트 없음 (PLAN-003 brief §3 확정)
- **refresh rotation**: rolling rotation + reuse detection (재사용 시 모든 refresh 무효화)
- **위장 응답 미적용**: 앱 내부 화면 전용 도메인. chat/pairing/attachment 와 구분
- **PUT 미사용**: 모든 변경은 POST (development_conventions §8 금지 패턴)
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-AUTH_
