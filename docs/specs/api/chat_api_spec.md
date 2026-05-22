# chat API 명세서 v1.0

---

## 1. 개요

chat API 는 WebSocket 기반 실시간 채팅 채널과 메시지 히스토리 REST 조회를 담당한다 (REQ-015). 메시지 전송·삭제·첨부 처리는 별도 `message` / `attachment` 도메인 명세 참조.

본 도메인은 **위장 응답** 적용 (dev_conventions §4-4). WebSocket handshake 단계의 모든 거부는 HTTP 404 + 일반 응답 본문 형태 (위장).

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | access + unlock_token 필수 |

**공통 규칙**:
- WebSocket handshake 시 access + unlock_token 검증 → 실패 시 404 응답 + 연결 거부
- handshake 성공 시 서버가 자동으로 `pairing:<pairing_id>` 채널에 join. 클라이언트의 `subscribe` / `join` 이벤트는 등록 안 함 (SEC-005, dev_conventions §7-8)
- unlock_token 만료 / REVOKED → 서버가 즉시 연결 종료
- 메시지 본문은 평문 송수신 안 함 — 서버측 AES-256-GCM 단일키로 처리 (SEC-002). 클라이언트는 평문만 전송하고 평문만 수신 (TLS 가 회선 암호화 담당)
- 메시지 히스토리 조회는 REST (커서 기반 pagination)

---

## 2. 엔드포인트 목록

| # | 종류 | 메서드 / 경로 | 설명 | 인증 |
|---|---|---|---|---|
| 1 | WebSocket | `wss://<host>/ws` (handshake `GET`) | 실시간 채팅 채널 (handshake 시 자동 join) | access + unlock |
| 2 | REST | `GET /api/v1/chat/history` | 본인 페어의 메시지 히스토리 (커서 페이지네이션) | access + unlock |

WebSocket 서버 → 클라이언트 이벤트는 §4-1 의 §A 참조. 클라이언트 → 서버 이벤트는 정의하지 않음 (SEC-005).

---

## 3. 공통 응답 포맷

REST 응답은 development_conventions §4-3 (위장) 사용. WebSocket handshake 거부 응답도 동일 형식 (404 NEWS_ARTICLE_NOT_FOUND).

---

## 4. 엔드포인트 상세

### 4-1. WebSocket 채팅 채널

**경로**: `wss://<host>/ws`

**프로토콜**: Socket.IO (NestJS `@nestjs/websockets` 기본 어댑터)

**설명**: 페어링된 에이전트가 실시간 메시지·이벤트를 송수신하는 채널. handshake 단계에서 서버가 인증·페어 상태를 검증하고, 통과 시 자동으로 `pairing:<pairing_id>` 룸에 join. 이후 모든 이벤트는 서버 → 클라이언트 단방향.

**인증 (handshake)**:
- `Authorization: Bearer <access>` (Socket.IO `auth.token` 또는 헤더)
- `X-Unlock-Token: <unlock>` (Socket.IO `auth.unlockToken` 또는 헤더)

**handshake 처리 흐름**:
1. Gateway 가 `auth.token` / `auth.unlockToken` 추출
2. access JWT 검증 → agent_id 추출. 실패 시 handshake 거부 (HTTP 404 + 위장 본문 — Engine.IO transport 단계)
3. unlock_token JWT 검증 → jti 추출
4. `unlock_sessions WHERE token_jti=? AND agent_id=? AND status='ACTIVE'` 조회. 미존재 / 만료 → 거부 (404)
5. 활성 페어 조회: `pairings WHERE (requester_agent_id=? OR recipient_agent_id=?) AND status='PAIRED' AND deleted_at IS NULL`
6. 미존재 → 거부 (404)
7. `socket.join('pairing:' + pairing.id)` (서버측 강제). client 의 `socket.on('subscribe', ...)` / `socket.on('join', ...)` handler 는 등록 안 함 — client 가 직접 join 시도해도 무시
8. handshake 성공. `connection:ready` 이벤트로 메타 정보 push
9. unlock_session.last_seen_at 갱신 (handshake 동안 자동 ping 역할)

**handshake 성공 직후 server → client 이벤트**:
- **이벤트명**: `connection:ready`
- **payload**:
  ```json
  {
    "pairing": { "externalId": "uuid", "status": "PAIRED" },
    "counterpart": { "externalId": "uuid", "nickname": "에이전트02" },
    "unlockExpiresAt": "2026-05-20T10:30:00.000Z"
  }
  ```

### §A. server → client 이벤트 목록

| 이벤트명 | 트리거 | 페이로드 |
|---|---|---|
| `connection:ready` | handshake 성공 | 위 참조 |
| `message:new` | 페어 상대가 메시지 전송 (message 도메인 POST /messages 직후) | `{ message: { externalId, senderExternalId, sentAt, body, attachment? } }` (body 는 서버에서 복호화된 평문) |
| `attachment:available` | 첨부 업로드 완료 (PENDING → AVAILABLE) | `{ messageExternalId, attachment: { externalId, mimeType, fileSizeBytes, originalFilename } }` |
| `pairing:paired` | 페어링 수락 (PAIRING_REQUESTED → PAIRED, 단 이미 연결돼 있는 경우) | `{ pairing: { externalId, status: 'PAIRED' } }` |
| `pairing:disconnected` | 페어 해제 (PAIRED → DISCONNECTED) | `{ pairing: { externalId, status: 'DISCONNECTED' } }` → 클라이언트는 채팅 화면 즉시 종료 |
| `unlock:revoked` | unlock_session REVOKED (모든 사유) | `{ reason: 'BACKGROUND' \| 'LOGOUT' \| 'APP_RESTART' \| 'PAIR_DISCONNECT' \| 'NEW_UNLOCK' }` → 클라이언트는 뉴스 피드 강제 이동 |
| `unlock:expiring` | unlock 만료 1분 전 (선택, v1 권장) | `{ expiresAt: '...' }` → 클라이언트는 시퀀스 재입력 유도 또는 자동 ping |

### §B. client → server 이벤트

**없음**. handler 미등록 (SEC-005, dev_conventions §7-8). 클라이언트가 `socket.emit('subscribe', ...)` / `socket.emit('message', ...)` 등 호출해도 무시.

메시지 전송은 별도 REST endpoint (`POST /api/v1/messages` — message 도메인) 로 수행. 서버는 전송 후 페어 상대에게 `message:new` 이벤트를 broadcast.

### §C. 연결 종료 사유 (서버 측)

| 사유 | 종료 시점 |
|---|---|
| unlock_token 만료 (`EXPIRED`) | unlock_session 폴링 또는 worker 가 감지 시 즉시 |
| 백그라운드 5초+ | worker 가 REVOKED 처리 + 이벤트 push 후 종료 |
| 페어 해제 (`DISCONNECTED`) | disconnect endpoint 처리 직후 |
| 양측 logout | logout endpoint 처리 직후 |
| 서버 재시작 | 클라이언트가 자동 재연결 (단 unlock 유효 시에만 성공) |

### §D. handshake 거부 응답 (HTTP 404, 위장)

Engine.IO transport 가 handshake 거부 시 HTTP 404 응답:

```json
{
  "success": false,
  "error": { "code": "NEWS_ARTICLE_NOT_FOUND", "message": "기사를 찾을 수 없습니다.", "traceId": "uuid" },
  "meta": { "timestamp": "..." }
}
```

거부 사유 (모두 외부 동일 응답):
- access 토큰 누락 / 형식 / 만료
- unlock_token 누락 / 형식 / 만료 / REVOKED
- 활성 PAIRED 페어 없음
- agent_id 와 unlock_token.agent_id 불일치

**부수효과**:
- handshake 성공 시 unlock_sessions.last_seen_at 갱신
- audit_logs 미기록 (빈번 연결)
- 연결 종료 시 audit 미기록 (소켓 lifecycle 은 자체 로깅)

---

### 4-2. 메시지 히스토리 조회 (REST)

**메서드 + URL**: `GET /api/v1/chat/history`

**설명**: 현재 PAIRED 페어의 메시지 히스토리를 커서 기반으로 조회한다. 본인 페어가 아니면 위장 404.

**인증**: access + unlock

**권한**: 본인이 참여한 PAIRED 페어의 messages 만 (permission_policy §4-1-1)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)

**Query Parameters**:
- `cursor`: string (optional, base64url 인코딩 `<sent_at_iso>:<message_id>`)
- `size`: int (1..50, default 30)
- `direction`: `'before'` (default) | `'after'` — cursor 기준 더 오래된 / 더 최신

**처리 흐름**:
1. Guards. 위반 시 위장 404
2. 활성 PAIRED 페어 조회: `pairings WHERE (requester_agent_id=req.user.agentId OR recipient_agent_id=req.user.agentId) AND status='PAIRED' AND deleted_at IS NULL`
3. 미존재 → 위장 404
4. cursor 디코드 (실패 시 무시, 처음부터)
5. `SELECT id, external_id, sender_agent_id, ciphertext, iv, tag, has_attachment, sent_at FROM messages WHERE pairing_id=? AND deleted_at IS NULL AND (cursor 조건) ORDER BY sent_at DESC, id DESC LIMIT ?`
6. 각 row 의 ciphertext 를 AES-256-GCM 복호화 (`MESSAGE_ENC_KEY`)
7. has_attachment=true 인 message 의 첨부 메타 일괄 조회 (`SELECT ... FROM message_attachments WHERE message_id IN (...) AND status='AVAILABLE'`)
8. sender_agent_id → external_id 조인
9. nextCursor 계산 (size 만큼 받은 경우 마지막 row 기준)
10. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "externalId": "uuid",
        "senderExternalId": "uuid (counterpart 또는 self)",
        "body": "복호화된 평문 메시지",
        "sentAt": "2026-05-20T10:00:00.000Z",
        "attachment": {
          "externalId": "uuid",
          "mimeType": "image/jpeg",
          "fileSizeBytes": 245678,
          "originalFilename": "agent_photo.jpg"
        }
      }
    ],
    "nextCursor": "base64url-or-null",
    "hasMore": true
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

`attachment` 필드는 첨부 없거나 status ≠ AVAILABLE 인 경우 생략. presigned URL 은 별도 attachment 도메인의 `GET /attachments/:externalId/url` 호출로 발급.

**에러 (모두 위장 404 또는 401 — handshake-style)**:
| 사유 | HTTP | 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 우선 |
| 활성 PAIRED 페어 없음 | 404 | NEWS_ARTICLE_NOT_FOUND |
| cursor 형식 위반 | 200 (무시) | 처음부터 반환 — 외부 단서 안 줌 |
| size 범위 위반 | 404 | 위장 404 (외부 형식 검증 실패는 거부) |
| 서버 오류 / 복호화 실패 | 500 | INTERNAL_ERROR (내부 알람) |

**부수효과**: 없음 (조회만, audit 미기록).

---

## 5. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| WS /ws | "메시지 수신 (WebSocket)" — PAIRED + unlock_token 유효 | ✓ |
| GET /chat/history | messages 조회 — 본인 페어, unlock 유효 | ✓ |

handshake 의 서버 자동 join 정책은 SEC-005 + dev_conventions §7-8 와 정합. 클라이언트 subscribe 이벤트 미등록.

---

## 6. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 |
|---|---|
| WS handshake | R: agents, pairings, unlock_sessions. W: unlock_sessions.last_seen_at |
| WS connection lifetime | W: unlock_sessions.last_seen_at (periodic) |
| GET /chat/history | R: pairings, messages, message_attachments, agents |

상태값: `pairings.status='PAIRED'` + `unlock_sessions.status='ACTIVE'` 두 조건 모두 검증.

---

## 7. WebSocket 보안 정합 (SEC-005)

1. **handshake 시 서버 자동 join**: `pairing:<pairing_id>` 룸. 클라이언트 join/subscribe handler 등록 안 함
2. **클라이언트 이벤트 거부**: `socket.onAny()` 로 정의되지 않은 이벤트는 무시. (또는 `socket.disconnect(true)` — 운영 결정. 권장: 무시 + audit 기록)
3. **room 격리**: 서버 측 어떤 broadcast 도 `io.to('pairing:<pairing_id>').emit(...)` 형식. 전체 broadcast 금지
4. **rate limit**: 동일 socket 의 ping 이벤트 1초당 1회 이상 시 차단
5. **연결당 단일 unlock_session**: 동일 agent_id 의 신규 unlock 발급(`NEW_UNLOCK`) 시 기존 socket 강제 종료 (`unlock:revoked` 이벤트 후 disconnect)
6. **TLS 강제**: `ws://` 거부, `wss://` 만 허용 (Nginx / 백엔드 설정)

---

## 8. 위장 / 보안 강화 사항

1. **handshake 거부도 위장 404**: HTTP 상태 코드와 응답 본문 모두 일반 뉴스 API 의 미존재 응답과 외부 식별 불가
2. **subscribe / join client 이벤트 미등록**: dev_conventions §8 금지 패턴 강제
3. **메시지 본문은 서버측 복호화**: 클라이언트는 평문만 보고, ciphertext / iv / tag 노출 없음
4. **히스토리 cursor 는 외부 단서 없음**: base64url 인코딩 + 단일 위장 응답
5. **room 격리**: 다른 페어의 메시지 누설 차단 (서버측 room 자동 join + broadcast)
6. **WebSocket 만료 즉시 종료**: lazy check 가 아니라 worker 가 active로 끊음

---

## 9. 클라이언트 구현 가이드 (참고)

RN 측은 다음 흐름을 따른다:

1. unlock 성공 → WebSocket 연결 (`auth.token` + `auth.unlockToken`)
2. `connection:ready` 수신 → 채팅 화면 진입 + `GET /chat/history` 첫 페이지 로딩
3. 사용자 메시지 전송 → `POST /api/v1/messages` (REST)
4. 응답 + 페어 상대로부터 `message:new` 수신 시 화면에 prepend
5. unlock 만료 1분 전 `unlock:expiring` 이벤트 또는 5초 주기 ping (background detection)
6. `unlock:revoked` 수신 → 즉시 뉴스 피드 강제 이동 (위장 유지)
7. `pairing:disconnected` 수신 → 채팅 화면 닫고 뉴스 피드 이동

---

## 전제 / 우선순위 적용

- **WebSocket 위장 응답**: handshake 거부도 일반 뉴스 API 의 미존재 응답과 외부 식별 불가
- **client → server 이벤트 없음**: 메시지 전송 등은 모두 REST. WebSocket 은 server → client 단방향
- **PUT 미사용**: 모든 변경 REST 는 POST
- **PAIRED + unlock ACTIVE 두 조건 동시 검증**: 한 조건만 검증 시 위장 깨질 가능성
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-CHAT_
