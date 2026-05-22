# user_management API 명세서 v1.0

---

## 1. 개요

user_management API 는 에이전트 본인의 프로필 조회·수정·탈퇴와 페어링 대상 사용자 검색을 담당한다.

본 도메인은 **두 가지 응답 모드** 가 공존한다:

- **앱 내부 (일반 응답)**: `/users/me` 계열 (`GET / PATCH / DELETE`) — 설정 화면 전용
- **위장 응답**: `/users/lookup/:externalId` — 채팅 모드 내부에서 호출, 외부 노출 가능. 권한 거부 시 `404 NEWS_ARTICLE_NOT_FOUND` (SEC-006)

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | JWT access token (Authorization 헤더) |

**공통 규칙**:
- access token 검증 (JwtAuthGuard)
- 모든 mutating 요청 `Idempotency-Key` 헤더 (SEC-008)
- 응답에 다른 사용자의 이메일 포함 금지 (SEC-004, dev_conventions §7-14)
- 외부 식별자는 `external_id` (uuid) 만 사용. internal bigserial 노출 금지 (SEC-004)

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 | 응답 모드 |
|---|---|---|---|---|---|
| 1 | GET | `/api/v1/users/me` | 본인 프로필 조회 | 필요 | 일반 |
| 2 | PATCH | `/api/v1/users/me` | 본인 닉네임 변경 | 필요 | 일반 |
| 3 | DELETE | `/api/v1/users/me` | 본인 계정 탈퇴 (soft delete) | 필요 | 일반 |
| 4 | GET | `/api/v1/users/lookup/:externalId` | 페어링 대상 사용자 조회 (검색 키 = external_id) | 필요 | 위장 |

---

## 3. 공통 응답 포맷

development_conventions.md §4-2 (일반) 와 §4-3 (위장) 을 엔드포인트별로 분기. `/users/me` 계열은 일반, `/users/lookup` 은 위장.

---

## 4. 엔드포인트 상세

### 4-1. 본인 프로필 조회

**메서드 + URL**: `GET /api/v1/users/me`

**설명**: 현재 인증된 에이전트의 프로필 정보를 반환한다. 시퀀스 등록 상태와 활성 페어 존재 여부 포함.

**인증**: 필요 (`Authorization: Bearer <access>`)

**권한**: 본인 row 만 (permission_policy §4-1-1 agents row, "조회 — 본인 row 만")

**Request Headers**:
- `Authorization: Bearer <access_token>` (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard → `req.user.agentId`
2. `SELECT external_id, email, nickname, status, created_at FROM agents WHERE id=? AND deleted_at IS NULL`
3. `SELECT status FROM agent_secret_sequences WHERE agent_id=? AND deleted_at IS NULL`
4. `SELECT external_id FROM pairings WHERE (requester_agent_id=? OR recipient_agent_id=?) AND status IN ('PAIRING_REQUESTED','PAIRED') AND deleted_at IS NULL LIMIT 1` → 활성 페어 external_id 또는 null
5. 응답 조립

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "externalId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "agent@example.com",
    "nickname": "에이전트01",
    "status": "ACTIVE",
    "sequenceStatus": "REGISTERED",
    "activePairing": {
      "externalId": "660e8400-e29b-41d4-a716-446655440000",
      "status": "PAIRED"
    },
    "createdAt": "2026-04-01T10:00:00.000Z"
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

`activePairing` 은 `PAIRING_REQUESTED` 또는 `PAIRED` 상태인 row 만. 없으면 `null`.

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | 401 | access token 만료 |
| `AUTH_TOKEN_INVALID` | 401 | 서명 / 형식 위반 |
| `USER_NOT_FOUND` | 404 | DB row 가 soft delete 됨 (이론상 거의 없음 — 토큰 무효화 시점 차이) |
| `INTERNAL_ERROR` | 500 | - |

**부수효과**: 없음 (audit 미기록 — 조회).

---

### 4-2. 본인 닉네임 변경

**메서드 + URL**: `PATCH /api/v1/users/me`

**설명**: 본인 닉네임을 변경한다. 이메일·비밀번호 변경은 v1 미지원.

**인증**: 필요

**권한**: 본인 row 만 (permission_policy §4-1-1, "수정 — 프로필")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "nickname": "신규닉네임" }
```

**검증**: 1~40자, 공백 trim 후 길이 검증.

**처리 흐름**:
1. JwtAuthGuard
2. 입력 검증 (class-validator)
3. 트랜잭션: `UPDATE agents SET nickname=?, updated_at=now() WHERE id=req.user.agentId AND deleted_at IS NULL RETURNING external_id, nickname`
4. 0 rows affected → `USER_NOT_FOUND`
5. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "externalId": "uuid",
    "nickname": "신규닉네임"
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `USER_VALIDATION_ERROR` | 400 | 닉네임 길이 위반 |
| `USER_NOT_FOUND` | 404 | row soft delete 됨 |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | - |

**부수효과**:
- agents.updated_at 갱신
- audit_logs 미기록 (단순 프로필 갱신)

---

### 4-3. 본인 계정 탈퇴

**메서드 + URL**: `DELETE /api/v1/users/me`

**설명**: 본인 계정을 soft delete 한다. 활성 페어가 있으면 먼저 페어 해제를 요구한다 (선행 정리 강제).

**인증**: 필요

**권한**: 본인 row 만 (permission_policy §4-1-1, "삭제 — 탈퇴 soft")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "passwordConfirmation": "현재_비밀번호" }
```

**검증**: 비밀번호 재확인으로 의도성 검증.

**처리 흐름**:
1. JwtAuthGuard
2. `SELECT password_hash FROM agents WHERE id=? AND deleted_at IS NULL`
3. bcrypt compare → 실패 시 `AUTH_INVALID_CREDENTIALS`
4. 활성 페어 검사: `pairings WHERE (requester_agent_id=? OR recipient_agent_id=?) AND status IN ('PAIRING_REQUESTED','PAIRED') AND deleted_at IS NULL`
5. 활성 페어 존재 → `USER_ACTIVE_PAIR_EXISTS` (먼저 해제 요구)
6. 트랜잭션:
   - `UPDATE agents SET status='DELETED', deleted_at=now() WHERE id=?`
   - `UPDATE agent_secret_sequences SET deleted_at=now() WHERE agent_id=?`
   - `UPDATE refresh_tokens SET revoked_at=now() WHERE agent_id=? AND revoked_at IS NULL`
   - `UPDATE unlock_sessions SET status='REVOKED', revoked_reason='LOGOUT' WHERE agent_id=? AND status='ACTIVE'`
   - `UPDATE push_tokens SET deleted_at=now() WHERE agent_id=? AND deleted_at IS NULL`
   - `INSERT INTO audit_logs (kind='USER_DELETE', actor_agent_id=?, actor_kind='agent', target_type='agent', target_id=?)`
7. 트랜잭션 commit
8. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "deleted": true },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | - |
| `AUTH_INVALID_CREDENTIALS` | 401 | passwordConfirmation 불일치 |
| `USER_ACTIVE_PAIR_EXISTS` | 409 | 활성 페어 존재. 먼저 페어 해제 필요 |
| `IDEMPOTENCY_KEY_MISSING` | 400 | - |

**부수효과**:
- agents soft delete
- agent_secret_sequences soft delete (cascade)
- refresh_tokens 전체 revoke
- unlock_sessions ACTIVE → REVOKED
- push_tokens soft delete
- audit_logs: `USER_DELETE`

---

### 4-4. 페어링 대상 사용자 조회

**메서드 + URL**: `GET /api/v1/users/lookup/:externalId`

**설명**: 페어링 검색용. external_id 로 다른 에이전트의 공개 프로필을 조회한다. 본인 / 이미 활성 페어 중인 사용자 / soft delete 사용자 / 존재하지 않는 사용자는 모두 동일하게 `404 NEWS_ARTICLE_NOT_FOUND` 위장 응답 (REQ-009, REQ-010, SEC-006).

**인증**: 필요

**권한**: agent (permission_policy §4-1-2, "사용자 ID 검색"). 자기/페어중 제외 규칙은 본 도메인에서 강제

**Request Headers**:
- `Authorization: Bearer <access>` (필수)

**Path Parameters**:
- `externalId`: uuid (필수)

**Request Body**: 없음

**처리 흐름**:
1. JwtAuthGuard → `req.user.agentId`
2. `externalId` uuid 형식 검증 (실패 시 위장 404)
3. `SELECT id, external_id, nickname FROM agents WHERE external_id=? AND status='ACTIVE' AND deleted_at IS NULL`
4. 미존재 → 위장 404
5. **자기 자신 체크**: 조회된 `id` = `req.user.agentId` → 위장 404
6. **활성 페어 체크**: `pairings WHERE (requester_agent_id=조회된id OR recipient_agent_id=조회된id) AND status IN ('PAIRING_REQUESTED','PAIRED') AND deleted_at IS NULL LIMIT 1` → 존재 시 위장 404
7. 응답 (이메일 절대 포함 X)

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "externalId": "uuid",
    "nickname": "에이전트02"
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 코드 | HTTP | 발생 조건 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` / `AUTH_TOKEN_INVALID` | 401 | (그대로 401 — 토큰 검증은 위장 적용 안 함. JwtAuthGuard 단계) |
| `NEWS_ARTICLE_NOT_FOUND` | 404 | externalId 형식 위반 / 미존재 / 본인 / 이미 페어 중 / soft delete 됨 — 모두 동일 응답 |

**위장 응답 본문**:
```json
{
  "success": false,
  "error": { "code": "NEWS_ARTICLE_NOT_FOUND", "message": "기사를 찾을 수 없습니다.", "traceId": "uuid" },
  "meta": { "timestamp": "..." }
}
```

**부수효과**: 없음 (audit 미기록 — 위장 침묵 원칙).

---

## 5. 권한 정합 (G3)

본 명세의 모든 엔드포인트 권한은 permission_policy.md §4-1-1, §4-1-2 와 일치한다.

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| GET /users/me | agents 조회 — 본인 row | ✓ |
| PATCH /users/me | agents 수정 — 프로필 | ✓ |
| DELETE /users/me | agents 삭제 — 탈퇴 soft | ✓ |
| GET /users/lookup/:externalId | "사용자 ID 검색" 액션 — 자기/페어중 제외 | ✓ |

---

## 6. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 대상 |
|---|---|
| GET /users/me | R: agents, agent_secret_sequences, pairings |
| PATCH /users/me | W: agents (nickname, updated_at) |
| DELETE /users/me | W: agents, agent_secret_sequences, refresh_tokens, unlock_sessions, push_tokens, audit_logs |
| GET /users/lookup/:externalId | R: agents, pairings |

모든 컬럼은 db_design §4-1, §4-2, §4-7 정의를 따른다.

---

## 7. 보안 / 위장 강화 사항

1. **이메일 노출 차단**: `/users/lookup` 응답에 이메일 절대 미포함. 본인 조회 `/users/me` 만 본인 이메일 노출
2. **위장 응답 통일**: `/users/lookup` 의 모든 거부 케이스 (형식 위반 / 미존재 / 본인 / 페어중 / 삭제됨) 를 단일 `NEWS_ARTICLE_NOT_FOUND` 로 통일 — 외부 식별 단서 차단 (REQ-009)
3. **자기 자신 검색 차단**: external_id 우연 일치 노출 차단 (REQ-010 acceptance)
4. **이미 페어 중인 사용자 검색 차단**: 다른 사용자의 페어 관계 추적 차단 (REQ-010 acceptance)
5. **사용자 열거 차단**: lookup 의 응답 시간 일정화 (DB 조회 후 페어 체크까지 항상 수행, early return 금지)
6. **탈퇴 시 활성 페어 강제 정리**: 메시지/첨부 cascade 누락 방지. 페어 해제 → audit + MinIO 정리 후 탈퇴 가능
7. **DELETE /users/me 비밀번호 재확인**: 토큰 탈취 후 자동 탈퇴 차단

---

## 8. 향후 확장 메모 (v1 비-목표)

- 이메일 변경 / 비밀번호 변경 (v1 미지원)
- 사용자 닉네임 기반 검색 (v1 미지원 — external_id 만)
- 차단 목록 / 신고 기능 (v1 비-목표)

---

## 전제 / 우선순위 적용

- **응답 모드 분리**: `/users/me` 일반 / `/users/lookup` 위장 — 노출 컨텍스트가 다름
- **이메일 검색 금지**: external_id (uuid) 만 (REQ-010 + intake §G-4 정합)
- **활성 페어 = PAIRING_REQUESTED ∪ PAIRED**: state_transition 의 정의 따름
- **PUT 미사용**: PATCH 만
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-USER_MANAGEMENT_
