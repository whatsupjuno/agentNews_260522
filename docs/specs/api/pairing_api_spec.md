# pairing API 명세서 v1.0

---

## 1. 개요

pairing API 는 에이전트 간 1:1 페어링 라이프사이클 (요청 / 수락 / 거부 / 취소 / 해제) 을 담당한다. PLAN-003 의 자율 페어링 모델 — admin 사전 설정 없이 사용자 검색 → 요청 → 응답 흐름.

본 도메인은 **모두 위장 응답** (dev_conventions §4-4). 채팅 모드 내부에서만 호출되므로 외부 노출 시 권한 거부는 `404 NEWS_ARTICLE_NOT_FOUND` 로 통일 (SEC-006, REQ-009).

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | JWT access + unlock_token (모든 mutating 작업) |

**공통 규칙**:
- 모든 엔드포인트 = `Authorization: Bearer <access>` + `X-Unlock-Token: <unlock>` 필수 (페어링 작업은 채팅 모드 안에서만)
- 1 active pair 제약 (REQ-014): 같은 agent 가 `PAIRING_REQUESTED` 또는 `PAIRED` 상태인 row 1개만 허용. DB partial unique index 로 강제 (db_design §4-7)
- 모든 mutating 요청에 `Idempotency-Key` 헤더 (SEC-008)
- 외부 식별자는 `external_id` (uuid) 만 (SEC-004)
- 위장 응답: 거부 / 미존재 / 권한 없음 / 본인 페어 아님 / 상태 위반 — 모두 `404 NEWS_ARTICLE_NOT_FOUND`

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 | 응답 모드 |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/pairings` | 페어링 요청 발송 (검색 결과 → 요청) | access + unlock | 위장 |
| 2 | GET | `/api/v1/pairings/current` | 현재 활성 페어 조회 (PAIRING_REQUESTED / PAIRED) | access + unlock | 위장 |
| 3 | POST | `/api/v1/pairings/:externalId/accept` | 요청 수락 (수신자) | access + unlock | 위장 |
| 4 | POST | `/api/v1/pairings/:externalId/reject` | 요청 거부 (수신자) | access + unlock | 위장 |
| 5 | POST | `/api/v1/pairings/:externalId/cancel` | 요청 취소 (요청자) | access + unlock | 위장 |
| 6 | POST | `/api/v1/pairings/:externalId/disconnect` | 페어 해제 (양측 누구나) | access + unlock | 위장 |

---

## 3. 공통 응답 포맷

development_conventions §4-3 (위장) 사용. 권한 거부 / 상태 위반 / 미존재 모두 동일 응답 본문.

**위장 응답 (HTTP 404)**:
```json
{
  "success": false,
  "error": { "code": "NEWS_ARTICLE_NOT_FOUND", "message": "기사를 찾을 수 없습니다.", "traceId": "uuid" },
  "meta": { "timestamp": "..." }
}
```

---

## 4. 엔드포인트 상세

### 4-1. 페어링 요청 발송

**메서드 + URL**: `POST /api/v1/pairings`

**설명**: 검색된 상대방의 external_id 로 페어링 요청을 발송한다 (REQ-011). 위장 푸시 알림이 수신자에게 발송됨. status `(없음)` → `PAIRING_REQUESTED`.

**인증**: access + unlock

**권한**: agent (permission_policy §4-1-2, "페어링 요청 발송"). 1 active pair 제약

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{ "targetExternalId": "uuid (상대방 agents.external_id)" }
```

**처리 흐름**:
1. JwtAuthGuard + UnlockTokenGuard. 실패 시 위장 404
2. 입력 검증 (uuid 형식). 위반 시 위장 404
3. `targetExternalId` 로 `agents WHERE external_id=? AND status='ACTIVE' AND deleted_at IS NULL` 조회
4. 미존재 → 위장 404
5. **자기 자신** 또는 **이미 활성 페어 중인 사용자** → 위장 404 (user_management §4-4 의 검색 차단 규칙과 동일 — IDOR 방지)
6. 본인 1 active pair 체크: `pairings WHERE (requester_agent_id=req.user.agentId OR recipient_agent_id=req.user.agentId) AND status IN ('PAIRING_REQUESTED','PAIRED') AND deleted_at IS NULL LIMIT 1`
7. 본인 활성 페어 존재 → 위장 404 (외부 응답) + 내부 audit `PAIRING_REQUEST` 시도 기록 안 함 (실패는 침묵)
8. 트랜잭션:
   - `INSERT INTO pairings (external_id, requester_agent_id, recipient_agent_id, status='PAIRING_REQUESTED', requested_at=now()) RETURNING external_id`
   - DB partial UQ 위반 시 (race condition) → 위장 404
   - `INSERT INTO notification_queue (recipient_agent_id=target_id, trigger_kind='PAIRING_REQUEST', trigger_pairing_id=신규 pairing.id, fake_headline_id=랜덤 active headline, scheduled_at=now()+0..60s 랜덤)`
   - `INSERT INTO audit_logs (kind='PAIRING_REQUEST', actor_agent_id=req.user.agentId, actor_kind='agent', target_type='pairing', target_id=신규 pairing.id, target_external_id=신규 external_id)`
9. commit 후 FCM worker 가 jitter 만료 시 발송
10. 응답

**응답 (201 Created)**:
```json
{
  "success": true,
  "data": {
    "pairing": {
      "externalId": "uuid",
      "status": "PAIRING_REQUESTED",
      "role": "requester",
      "counterpart": { "externalId": "uuid (target)", "nickname": "에이전트02" },
      "requestedAt": "2026-05-20T10:00:00.000Z"
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러 (모두 위장 404 — `NEWS_ARTICLE_NOT_FOUND` 통일)**:
| 내부 사유 | HTTP | 외부 응답 |
|---|---|---|
| 토큰 만료 / 형식 위반 | 401 / 404 | (401 은 모바일 refresh 트리거. 본 도메인은 가능하면 위장 404 우선) |
| targetExternalId 미존재 / 본인 / 이미 페어 중 / 형식 위반 | 404 | NEWS_ARTICLE_NOT_FOUND |
| 본인 활성 페어 존재 | 404 | NEWS_ARTICLE_NOT_FOUND |
| Idempotency 누락 / 충돌 | 400 / 409 | Idempotency 자체는 외부 노출되어도 위장 무관 |
| 서버 오류 | 500 | INTERNAL_ERROR |

**부수효과**:
- pairings INSERT
- notification_queue INSERT (위장 푸시 큐잉)
- audit_logs: `PAIRING_REQUEST`

---

### 4-2. 현재 활성 페어 조회

**메서드 + URL**: `GET /api/v1/pairings/current`

**설명**: 본인의 활성 페어 (`PAIRING_REQUESTED` 또는 `PAIRED`) 또는 가장 최근 *처리 대기* 가 필요한 페어를 반환한다. 채팅 모드 진입 시 첫 호출.

**인증**: access + unlock

**권한**: 본인 참여 row 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)

**처리 흐름**:
1. Guards
2. `pairings WHERE (requester_agent_id=req.user.agentId OR recipient_agent_id=req.user.agentId) AND status IN ('PAIRING_REQUESTED','PAIRED') AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`
3. 없으면 `data.pairing = null` (active 페어 없음. 위장 404 아님 — 정상 흐름)
4. 상대 agent 닉네임 조회
5. 응답

**응답 (200 OK)** — 활성 페어 있음:
```json
{
  "success": true,
  "data": {
    "pairing": {
      "externalId": "uuid",
      "status": "PAIRING_REQUESTED",
      "role": "requester",
      "counterpart": { "externalId": "uuid", "nickname": "에이전트02" },
      "requestedAt": "...",
      "acceptedAt": null
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**응답 (200 OK)** — 활성 페어 없음:
```json
{
  "success": true,
  "data": { "pairing": null },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**`role` 필드**: `"requester"` 또는 `"recipient"` — 클라이언트가 수락/거부 vs 취소 UI 분기.

**에러**:
| 사유 | HTTP | 응답 |
|---|---|---|
| access/unlock 만료·위반 | 401 / 404 | 위장 404 (`NEWS_ARTICLE_NOT_FOUND`) |
| 서버 오류 | 500 | INTERNAL_ERROR |

**부수효과**: 없음.

---

### 4-3. 페어링 요청 수락

**메서드 + URL**: `POST /api/v1/pairings/:externalId/accept`

**설명**: 수신자가 페어링 요청을 수락한다 (REQ-012). status `PAIRING_REQUESTED` → `PAIRED`. WebSocket 채널이 즉시 활성화된다.

**인증**: access + unlock

**권한**: 본인이 수신자(`recipient_agent_id=req.user.agentId`)인 `PAIRING_REQUESTED` row 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Path Parameters**:
- `externalId`: uuid (필수, pairings.external_id)

**Request Body**: 없음

**처리 흐름**:
1. Guards. 위반 시 위장 404
2. `pairings WHERE external_id=? AND status='PAIRING_REQUESTED' AND recipient_agent_id=req.user.agentId AND deleted_at IS NULL FOR UPDATE`
3. 미존재 / 다른 사용자의 row → 위장 404
4. 트랜잭션:
   - `UPDATE pairings SET status='PAIRED', accepted_at=now()`
   - `INSERT INTO audit_logs (kind='PAIRING_ACCEPT', actor_agent_id=req.user.agentId, target_type='pairing', target_id=?, target_external_id=?)`
5. commit 후 WebSocket 게이트웨이가 양측에 `pairing:paired` 이벤트 push (이미 연결돼 있으면)
6. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "pairing": {
      "externalId": "uuid",
      "status": "PAIRED",
      "role": "recipient",
      "counterpart": { "externalId": "uuid", "nickname": "에이전트01" },
      "requestedAt": "...",
      "acceptedAt": "2026-05-20T10:05:00.000Z"
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**:
| 사유 | HTTP | 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 |
| pairing 미존재 / 다른 사용자 / 상태 위반 / 이미 처리됨 | 404 | NEWS_ARTICLE_NOT_FOUND |
| Idempotency 누락 / 충돌 | 400 / 409 | - |
| 서버 오류 | 500 | INTERNAL_ERROR |

**부수효과**:
- pairings status `PAIRING_REQUESTED` → `PAIRED`, accepted_at 갱신
- audit_logs: `PAIRING_ACCEPT`
- WebSocket: 양측 channel `pairing:<pairing_id>` 활성화 (이미 join 된 상태면 paired 이벤트 push)

---

### 4-4. 페어링 요청 거부

**메서드 + URL**: `POST /api/v1/pairings/:externalId/reject`

**설명**: 수신자가 요청을 거부한다. status `PAIRING_REQUESTED` → `PAIRING_REJECTED`. 요청자에게 위장 푸시 통지.

**인증**: access + unlock

**권한**: 본인이 수신자인 PAIRING_REQUESTED row 만

**Request Headers**: 4-3 과 동일

**Path Parameters**: `externalId` (필수)

**Request Body**: 없음

**처리 흐름**:
1. Guards
2. `pairings WHERE external_id=? AND status='PAIRING_REQUESTED' AND recipient_agent_id=req.user.agentId AND deleted_at IS NULL FOR UPDATE`
3. 미존재 / 다른 사용자 → 위장 404
4. 트랜잭션:
   - `UPDATE pairings SET status='PAIRING_REJECTED', ended_at=now(), ended_by_agent_id=req.user.agentId`
   - 위장 푸시 큐잉: `INSERT INTO notification_queue (recipient_agent_id=요청자_id, trigger_kind='PAIRING_REJECT', trigger_pairing_id=?, fake_headline_id=랜덤, scheduled_at=now()+0..60s)`
   - `INSERT INTO audit_logs (kind='PAIRING_REJECT', actor_agent_id=req.user.agentId, target_type='pairing', target_id=?)`
5. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "pairing": { "externalId": "uuid", "status": "PAIRING_REJECTED", "endedAt": "..." } },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**: 4-3 과 동일 패턴.

**부수효과**:
- pairings status `PAIRING_REQUESTED` → `PAIRING_REJECTED`
- notification_queue INSERT (요청자에게 위장 푸시)
- audit_logs: `PAIRING_REJECT`

---

### 4-5. 페어링 요청 취소 (요청자)

**메서드 + URL**: `POST /api/v1/pairings/:externalId/cancel`

**설명**: 요청자가 본인이 발송한 PAIRING_REQUESTED 를 취소한다. status `PAIRING_REQUESTED` → `DISCONNECTED` (활성 페어 슬롯 즉시 해제).

**인증**: access + unlock

**권한**: 본인이 요청자(`requester_agent_id=req.user.agentId`)인 PAIRING_REQUESTED row 만

**Request Headers**: 4-3 과 동일

**Path Parameters**: `externalId` (필수)

**Request Body**: 없음

**처리 흐름**:
1. Guards
2. `pairings WHERE external_id=? AND status='PAIRING_REQUESTED' AND requester_agent_id=req.user.agentId AND deleted_at IS NULL FOR UPDATE`
3. 미존재 / 다른 사용자 → 위장 404
4. 트랜잭션:
   - `UPDATE pairings SET status='DISCONNECTED', ended_at=now(), ended_by_agent_id=req.user.agentId`
   - `INSERT INTO audit_logs (kind='PAIRING_CANCEL', actor_agent_id=?, target_type='pairing', target_id=?)`
   - 수신자에게 위장 푸시 큐잉 안 함 (취소는 통지 불필요. 수신자가 응답하기 전 사라짐)
5. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": { "pairing": { "externalId": "uuid", "status": "DISCONNECTED", "endedAt": "..." } },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**: 4-3 과 동일 패턴.

**부수효과**:
- pairings `PAIRING_REQUESTED` → `DISCONNECTED`
- audit_logs: `PAIRING_CANCEL`

---

### 4-6. 페어 해제

**메서드 + URL**: `POST /api/v1/pairings/:externalId/disconnect`

**설명**: 양측 중 일방이 PAIRED 페어를 해제한다 (REQ-013). 양측 메시지·첨부 즉시 `DELETED` 처리 + MinIO 객체 hard delete + 양측 unlock_session REVOKED.

**인증**: access + unlock

**권한**: 본인이 참여한(`requester_agent_id=? OR recipient_agent_id=?`) PAIRED row 만

**Request Headers**: 4-3 과 동일

**Path Parameters**: `externalId` (필수)

**Request Body**: 없음

**처리 흐름**:
1. Guards
2. `pairings WHERE external_id=? AND status='PAIRED' AND (requester_agent_id=req.user.agentId OR recipient_agent_id=req.user.agentId) AND deleted_at IS NULL FOR UPDATE`
3. 미존재 / 다른 사용자 → 위장 404
4. 트랜잭션 (db_design §9-1):
   - `UPDATE pairings SET status='DISCONNECTED', ended_at=now(), ended_by_agent_id=req.user.agentId`
   - `UPDATE messages SET status='DELETED', deleted_at=now() WHERE pairing_id=? AND deleted_at IS NULL` → 영향 받은 message ids 수집
   - `UPDATE message_attachments SET status='DELETED', deleted_at=now() WHERE message_id IN (...) AND deleted_at IS NULL` → 영향 받은 storage_keys 수집
   - `UPDATE unlock_sessions SET status='REVOKED', revoked_reason='PAIR_DISCONNECT' WHERE agent_id IN (requester, recipient) AND status='ACTIVE'`
   - `INSERT INTO audit_logs (kind='PAIRING_DISCONNECT', actor_agent_id=?, target_type='pairing', target_id=?)`
   - `INSERT INTO audit_logs (kind='MESSAGE_DELETE', ... 각 message)` — 또는 단일 cascade event 로 압축 (운영 결정)
5. commit 후 worker queue: MinIO 객체 hard delete (수집된 storage_keys)
6. commit 후 WebSocket: 양측에 `pairing:disconnected` 이벤트 push + 연결 종료
7. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "pairing": { "externalId": "uuid", "status": "DISCONNECTED", "endedAt": "..." },
    "deletedMessageCount": 142,
    "deletedAttachmentCount": 18
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러**: 4-3 과 동일 패턴.

**부수효과**:
- pairings `PAIRED` → `DISCONNECTED`
- messages 일괄 soft delete (cascade)
- message_attachments 일괄 soft delete + MinIO hard delete (worker)
- unlock_sessions 양측 REVOKED (`PAIR_DISCONNECT`)
- audit_logs: `PAIRING_DISCONNECT` (+ 메시지/첨부 cascade 이벤트)
- WebSocket: 양측 연결 종료

---

## 5. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| POST /pairings | 페어링 요청 발송 (1 active pair 제약) | ✓ |
| GET /pairings/current | pairings 조회 — 본인 참여 row | ✓ |
| POST /pairings/:id/accept | 페어링 수락 — 수신자 row | ✓ |
| POST /pairings/:id/reject | 페어링 거부 — 수신자 row | ✓ |
| POST /pairings/:id/cancel | 페어링 취소 — 요청자 row | ✓ |
| POST /pairings/:id/disconnect | 페어링 해제 — 양측 누구나 | ✓ |

---

## 6. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 |
|---|---|
| POST /pairings | R: agents. W: pairings, notification_queue, audit_logs |
| GET /pairings/current | R: pairings, agents |
| POST /pairings/:id/accept | W: pairings (status, accepted_at), audit_logs |
| POST /pairings/:id/reject | W: pairings, notification_queue, audit_logs |
| POST /pairings/:id/cancel | W: pairings, audit_logs |
| POST /pairings/:id/disconnect | W: pairings, messages, message_attachments, unlock_sessions, audit_logs |

상태 매핑: 모든 pairings.status 전이 (PAIRING_REQUESTED, PAIRED, PAIRING_REJECTED, DISCONNECTED) 가 본 명세에서 실행됨.

---

## 7. WebSocket 정합

페어링 상태 전이 시 WebSocket 게이트웨이 (`chat_api` 명세 도메인) 가 다음 이벤트를 양측에 push:

| 전이 | 이벤트 | 목적 |
|---|---|---|
| `PAIRING_REQUESTED` → `PAIRED` (accept) | `pairing:paired` | 채팅 채널 활성화, 양측 UI 갱신 |
| `PAIRED` → `DISCONNECTED` (disconnect) | `pairing:disconnected` | 양측 연결 종료, 채팅 화면 닫기 |

`PAIRING_REQUESTED` / `PAIRING_REJECTED` / `PAIRING_CANCEL` 은 WebSocket 미관여 (위장 푸시로만 통지).

WebSocket join 정책은 chat 도메인 명세 참조 (SEC-005, dev_conventions §7-8).

---

## 8. 위장 / 보안 강화 사항

1. **모든 거부 = `NEWS_ARTICLE_NOT_FOUND` 404**: 권한 거부 / 미존재 / 상태 위반 / 다른 사용자 row 모두 외부에서 식별 불가
2. **1 active pair race condition 방어**: DB partial unique index 가 트랜잭션 내 race 차단. 위반 시 위장 404 변환
3. **사용자 열거 차단 일관**: lookup API 와 동일하게 자기 / 페어중 / 미존재 모두 동일 응답
4. **취소는 통지 없음**: 거부와 달리 취소는 수신자에게 위장 푸시 안 발송 (요청 전달 전 사라진 케이스)
5. **disconnect 시 unlock 강제 REVOKE**: 페어 없는 unlock 무의미. 양측 모두 REVOKED 처리 후 채팅 화면 강제 종료
6. **disconnect 의 MinIO cascade 는 worker**: 트랜잭션 안에서 외부 시스템 호출 금지 (dev_conventions §6)
7. **counterpart 정보 최소 노출**: external_id + nickname 만. 이메일 / internal id 미포함

---

## 전제 / 우선순위 적용

- **모든 엔드포인트 위장 응답**: 라우트군 metadata 에 `@DisguiseOnError()` 데코레이터 적용 (dev_conventions §4-3)
- **1 active pair = DB constraint + application validation 이중 방어**
- **자율 페어링 모델**: admin 사전 설정 없음. 사용자 검색 → 요청 → 응답 흐름 (intake §1 명시)
- **PUT 미사용**: status 전이는 path action POST (`/:id/accept` 등)
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-PAIRING_
