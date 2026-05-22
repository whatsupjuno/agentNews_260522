# message API 명세서 v1.0

---

## 1. 개요

message API 는 1:1 비밀 채팅 메시지의 전송과 단건 조회를 담당한다 (REQ-016). 메시지 본문은 서버측 AES-256-GCM 단일키로 암호화 저장된다 (SEC-002). 히스토리(목록) 조회는 chat 도메인 `/chat/history` 참조.

본 도메인은 **모두 위장 응답** (dev_conventions §4-4). 권한 거부 / 미존재 / 페어 아님 / unlock 만료 — 모두 `404 NEWS_ARTICLE_NOT_FOUND` (SEC-006).

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | access + unlock_token 필수 |

**공통 규칙**:
- `Authorization: Bearer <access>` + `X-Unlock-Token: <unlock>` 모두 필수
- mutating 요청에 `Idempotency-Key` 헤더 (SEC-008)
- 외부 식별자 `external_id` (uuid) 만 (SEC-004)
- 메시지 본문 평문은 DB 저장 금지 — ciphertext / iv / tag 분리 저장 (db_design §4-8, dev_conventions §7-4)
- 메시지 수정 / 사용자 명시 삭제 v1 미지원 (permission_policy §4-1-2)
- 자동 삭제 (90일 / 페어 해제) 는 worker / 페어 해제 endpoint 가 처리. 본 도메인에 DELETE 엔드포인트 없음

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 | 응답 모드 |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/messages` | 메시지 전송 (텍스트, 첨부 연결 옵션) | access + unlock | 위장 |
| 2 | GET | `/api/v1/messages/:externalId` | 단건 메시지 조회 (외부 식별자) | access + unlock | 위장 |

목록 조회는 chat 도메인 `GET /chat/history` 사용.

---

## 3. 공통 응답 포맷

development_conventions §4-3 (위장) 사용. 모든 거부 응답:

```json
{
  "success": false,
  "error": { "code": "NEWS_ARTICLE_NOT_FOUND", "message": "기사를 찾을 수 없습니다.", "traceId": "uuid" },
  "meta": { "timestamp": "..." }
}
```

---

## 4. 엔드포인트 상세

### 4-1. 메시지 전송

**메서드 + URL**: `POST /api/v1/messages`

**설명**: 본인 활성 PAIRED 페어에 텍스트 메시지를 전송한다 (REQ-016). 옵션으로 미리 업로드한 첨부 (`attachmentExternalId`) 를 연결할 수 있다. status `(없음)` → `SENT`. 전송 후 페어 상대 WebSocket 으로 `message:new` push + 위장 푸시 큐잉.

**인증**: access + unlock

**권한**: 본인 활성 PAIRED 페어의 sender 만 (permission_policy §4-1-2 "메시지 전송")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)
- `Idempotency-Key: <uuid>` (필수)

**Request Body**:
```json
{
  "body": "안녕, 첩보원 02. 임무 받았어?",
  "attachmentExternalId": "uuid (optional)"
}
```

**검증**:
- `body`: 1~4000자. 양 끝 공백 trim. 빈 문자열 거부. 첨부 있어도 빈 body 거부 (UX 일관성)
- `attachmentExternalId`: 있으면 uuid v4 형식

**처리 흐름**:
1. JwtAuthGuard + UnlockTokenGuard. 위반 시 위장 404
2. 입력 검증. body 길이 초과 / 빈 문자열 / 형식 위반 → 위장 404
3. 활성 PAIRED 페어 조회: `pairings WHERE (requester_agent_id=req.user.agentId OR recipient_agent_id=req.user.agentId) AND status='PAIRED' AND deleted_at IS NULL`
4. 미존재 → 위장 404
5. 첨부 옵션 있으면:
   - `message_attachments WHERE external_id=? AND uploader_agent_id=req.user.agentId AND status='PENDING' AND deleted_at IS NULL FOR UPDATE`
   - 미존재 / 다른 사용자 / 이미 다른 message 연결 → 위장 404
6. AES-256-GCM 암호화:
   - iv = `crypto.randomBytes(12)`
   - ciphertext + tag = `crypto.createCipheriv('aes-256-gcm', MESSAGE_ENC_KEY, iv).update(body).getAuthTag()`
7. 트랜잭션:
   - `INSERT INTO messages (external_id, pairing_id, sender_agent_id, status='SENT', ciphertext, iv, tag, has_attachment=?, sent_at=now()) RETURNING id, external_id, sent_at`
   - 첨부 옵션 있으면: `UPDATE message_attachments SET message_id=?, status='AVAILABLE', uploaded_at=now() WHERE id=?` — 단 `magic_byte_verified=true` 인 경우에만 (PENDING 단계에서 검증 통과되어 있어야 함). 조건 위반 시 트랜잭션 롤백 → 위장 404
   - 위장 푸시 큐잉: 페어 상대를 recipient 로 `INSERT INTO notification_queue (trigger_kind=?, trigger_message_id=신규 message.id, fake_headline_id=랜덤 active headline, scheduled_at=now()+0..60s 랜덤)`
     - trigger_kind 결정: 첨부 없으면 `MESSAGE_TEXT`, image MIME 이면 `MESSAGE_IMAGE`, PDF 이면 `MESSAGE_FILE`
   - `INSERT INTO audit_logs (kind='MESSAGE_SEND', actor_agent_id=req.user.agentId, target_type='message', target_id=신규 id, target_external_id=신규 external_id)`
   - 첨부 연결 시 `INSERT INTO audit_logs (kind='ATTACHMENT_AVAILABLE', ...)`
8. commit 후 WebSocket 게이트웨이가 페어 상대에게 `message:new` 이벤트 push (복호화된 평문 + 첨부 메타)
9. commit 후 FCM worker 가 jitter 만료 시 위장 푸시 발송
10. 응답

**응답 (201 Created)**:
```json
{
  "success": true,
  "data": {
    "message": {
      "externalId": "uuid",
      "senderExternalId": "uuid (self)",
      "body": "안녕, 첩보원 02. 임무 받았어?",
      "sentAt": "2026-05-20T10:00:00.000Z",
      "attachment": {
        "externalId": "uuid",
        "mimeType": "image/jpeg",
        "fileSizeBytes": 245678,
        "originalFilename": "photo.jpg"
      }
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

`attachment` 는 첨부 없으면 생략.

**에러**:
| 사유 | HTTP | 외부 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 |
| body 형식 / 길이 위반 | 404 | NEWS_ARTICLE_NOT_FOUND |
| 활성 PAIRED 페어 없음 | 404 | NEWS_ARTICLE_NOT_FOUND |
| 첨부 미존재 / 다른 사용자 / 이미 연결 / 검증 미통과 | 404 | NEWS_ARTICLE_NOT_FOUND |
| Idempotency 누락 / 충돌 | 400 / 409 | (Idempotency 자체 — 위장 적용 안 함, 클라이언트 디버깅용) |
| 서버 오류 / 암호화 실패 | 500 | INTERNAL_ERROR (내부 알람) |

**부수효과**:
- messages INSERT (`SENT`)
- message_attachments status `PENDING` → `AVAILABLE` (첨부 옵션 시)
- notification_queue INSERT (위장 푸시 큐잉)
- audit_logs: `MESSAGE_SEND` (+ `ATTACHMENT_AVAILABLE`)
- WebSocket: `message:new` broadcast (페어 상대)

---

### 4-2. 단건 메시지 조회

**메서드 + URL**: `GET /api/v1/messages/:externalId`

**설명**: 본인 페어의 단일 메시지를 external_id 로 조회한다. WebSocket 으로 받은 `message:new` 이벤트의 backup 조회 또는 알림 클릭 후 deep link 처리에 사용.

**인증**: access + unlock

**권한**: 본인 참여 페어의 messages 만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)

**Path Parameters**:
- `externalId`: uuid (필수)

**처리 흐름**:
1. Guards. 위반 시 위장 404
2. uuid 형식 검증. 위반 시 위장 404
3. `SELECT m.id, m.external_id, m.pairing_id, m.sender_agent_id, m.ciphertext, m.iv, m.tag, m.has_attachment, m.sent_at, m.deleted_at, p.requester_agent_id, p.recipient_agent_id, p.status AS pairing_status FROM messages m JOIN pairings p ON p.id=m.pairing_id WHERE m.external_id=? LIMIT 1`
4. 다음 케이스 모두 위장 404:
   - row 미존재
   - `m.deleted_at IS NOT NULL` (삭제됨)
   - `req.user.agentId NOT IN (p.requester_agent_id, p.recipient_agent_id)` (본인 페어 아님)
   - `p.status NOT IN ('PAIRED','DISCONNECTED')` — DISCONNECTED 이면 메시지도 이미 deleted_at 됐으므로 어차피 4-1 케이스에 걸림
5. AES-256-GCM 복호화 (`MESSAGE_ENC_KEY`)
6. has_attachment=true 면 `message_attachments WHERE message_id=? AND status='AVAILABLE'` 조회
7. sender_agent_id → external_id
8. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": {
      "externalId": "uuid",
      "senderExternalId": "uuid (counterpart 또는 self)",
      "body": "복호화된 평문",
      "sentAt": "...",
      "attachment": {
        "externalId": "uuid",
        "mimeType": "image/jpeg",
        "fileSizeBytes": 245678,
        "originalFilename": "photo.jpg"
      }
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러 (모두 위장 404 — `NEWS_ARTICLE_NOT_FOUND`)**:
| 사유 | HTTP | 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 |
| externalId 형식 위반 | 404 | NEWS_ARTICLE_NOT_FOUND |
| 메시지 미존재 / 삭제됨 / 다른 페어 / 다른 사용자 | 404 | NEWS_ARTICLE_NOT_FOUND |
| 복호화 실패 (data corruption) | 500 | INTERNAL_ERROR (내부 알람 — 운영 사고) |

**부수효과**: 없음 (조회만, audit 미기록).

---

## 5. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| POST /messages | "메시지 전송" — PAIRED + unlock 유효 + 본인 페어 | ✓ |
| GET /messages/:externalId | messages 조회 — 본인 페어 | ✓ |

permission_policy §4-1-2 의 "메시지 수정 / 삭제" 는 v1 미지원 (-). 본 명세에 PATCH / DELETE endpoint 없음 → 정합.

---

## 6. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 |
|---|---|
| POST /messages | R: pairings, message_attachments. W: messages, message_attachments (status update), notification_queue, audit_logs |
| GET /messages/:externalId | R: messages, pairings, message_attachments, agents |

상태 매핑:
- messages.status: `(없음)` → `SENT` (4-1)
- message_attachments.status: `PENDING` → `AVAILABLE` (첨부 연결 시 4-1)
- notification_queue.status: `(없음)` → `QUEUED` (4-1)

90일 만료 / 페어 해제 cascade 는 worker / pairings disconnect endpoint 가 처리. 본 도메인의 응답 모드 (위장) 와 무관.

---

## 7. 암호화 사양 (SEC-002 정합)

### 7-1. 키 관리

- `MESSAGE_ENC_KEY` 환경변수 — 32바이트 (256비트) base64 인코딩
- 단일 서버측 키 (v1 범위 — per-pair 키는 v2 검토)
- 키 노출 시 모든 메시지 복호화 가능 → 운영 격리 (Docker secret / KMS 권장)

### 7-2. 암호화 과정 (전송 시)

```typescript
const iv = crypto.randomBytes(12);                              // 12B GCM nonce
const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
const ct1 = cipher.update(body, 'utf8');
const ct2 = cipher.final();
const ciphertext = Buffer.concat([ct1, ct2]);
const tag = cipher.getAuthTag();                                // 16B
// DB INSERT: ciphertext, iv, tag (각 bytea 컬럼)
```

### 7-3. 복호화 과정 (조회 시)

```typescript
const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
decipher.setAuthTag(tag);
const pt1 = decipher.update(ciphertext);
const pt2 = decipher.final();
const body = Buffer.concat([pt1, pt2]).toString('utf8');
```

tag 검증 실패 시 `decipher.final()` 이 throw → 500 INTERNAL_ERROR (data corruption 의심, audit + 운영 알람).

### 7-4. CHECK 제약 (db_design §4-8)

- `octet_length(iv) = 12`
- `octet_length(tag) = 16`

DB 레벨로 형식 위반 INSERT 차단.

---

## 8. WebSocket 통합 (chat 도메인 §A 정합)

### 8-1. 메시지 전송 후 broadcast

전송 트랜잭션 commit 직후:

```typescript
gateway.server
  .to('pairing:' + pairing.id)
  .except(senderSocketId)   // 발신자는 본인 API 응답으로 받음
  .emit('message:new', {
    message: { externalId, senderExternalId, body, sentAt, attachment? }
  });
```

발신자 본인 socket 에는 broadcast 제외 (REST 응답 + WebSocket 중복 방지).

### 8-2. 페어 상대가 오프라인일 때

- WebSocket 룸에 페어 상대 socket 없음 → broadcast 무효 (수신 없음)
- notification_queue 의 위장 푸시가 jitter 만료 후 FCM 발송 → 모바일이 알림 수신 → 탭하면 시퀀스 입력 후 채팅 화면 진입 → `GET /chat/history` 로 누락 메시지 동기화

### 8-3. unlock 만료 중 메시지 도착

- recipient 의 unlock 이 만료/REVOKED 였으면 WebSocket 룸에 없음 → broadcast 받지 못함
- 위장 푸시는 그대로 발송 (jitter 적용)
- 다음 unlock 시 history 조회로 동기화

---

## 9. 위장 / 보안 강화 사항

1. **모든 거부 = 위장 404**: 권한 거부 / 미존재 / 다른 페어 / 첨부 검증 미통과 모두 외부 식별 불가
2. **메시지 본문 평문 DB 저장 금지**: ciphertext / iv / tag 분리. CHECK 제약으로 형식 강제
3. **첨부 연결 시 magic_byte_verified=true 강제**: 미검증 첨부 연결 차단
4. **per-message iv**: 동일 키로 다른 메시지를 암호화해도 iv 가 다르면 안전. 절대 재사용 금지
5. **암호화/복호화 실패는 내부 500**: 외부 응답은 위장이지만 내부 운영 알람 발생 (data corruption / 키 mismatch)
6. **메시지 수정 endpoint 없음**: audit 보존 + 위장 정책 (메시지가 사라지거나 바뀌면 위장 깨질 우려). v1 미지원
7. **본인 명시 삭제 endpoint 없음**: 자동 삭제 (90일 / 페어 해제) 만. v1 미지원
8. **WebSocket broadcast 발신자 제외**: REST + WS 중복 수신 방지
9. **위장 푸시 trigger_kind 정확**: 첨부 종류별 분기 (`MESSAGE_TEXT` / `MESSAGE_IMAGE` / `MESSAGE_FILE`) — 외부 통지 카피 일관성 (REQ-021)

---

## 전제 / 우선순위 적용

- **메시지 수정·삭제 미지원**: brief / requirements_spec / permission_policy 모두 명시. v1 비-목표
- **모든 거부 위장 404**: 채팅은 가장 노출 위험 큰 도메인 — 모든 비정상 응답을 일반 뉴스 미존재 응답과 동일하게 가공
- **AES-256-GCM 단일키**: SEC-002 / dev_conventions §7-4 / db_design §4-8 정합
- **Idempotency-Key 필수**: 전송 중복 방지 — 동일 키 + 동일 hash → 캐시된 응답
- **PUT 미사용**: 모든 mutation = POST
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-MESSAGE_
