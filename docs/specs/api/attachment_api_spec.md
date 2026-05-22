# attachment API 명세서 v1.0

---

## 1. 개요

attachment API 는 채팅 첨부파일 (사진 / PDF) 의 업로드와 다운로드를 담당한다 (REQ-018, REQ-019, REQ-020). 저장소는 MinIO (S3 호환). 모든 업로드는 백엔드 경유 (presigned URL 발급은 다운로드만).

본 도메인은 **모두 위장 응답** (dev_conventions §4-4). 첨부 미존재 / 다른 페어 / 본인 아님 / unlock 만료 — 모두 `404 NEWS_ARTICLE_NOT_FOUND`.

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | access + unlock_token 필수 |

**공통 규칙**:
- `Authorization: Bearer <access>` + `X-Unlock-Token: <unlock>` 필수
- mutating 요청에 `Idempotency-Key` 헤더 (SEC-008)
- 외부 식별자 = `external_id` (uuid). storage_key 외부 노출 금지 (SEC-004)
- MIME allow-list 4종: `image/jpeg`, `image/png`, `image/webp`, `application/pdf` (SEC-007)
- 매직바이트 검증 통과 시에만 `AVAILABLE` 전이 (db_design §4-9)
- image MIME ≤ 10MB, PDF ≤ 25MB
- presigned URL 30분 유효 (REQ-019)
- 사용자 명시 삭제 미지원 — 자동 (90일 / 페어 해제) 만 (permission_policy §4-1-2)

---

## 2. 엔드포인트 목록

| # | 메서드 | URL | 설명 | 인증 | 응답 모드 |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/attachments` | 첨부 업로드 (multipart, 동기 매직바이트 검증) | access + unlock | 위장 |
| 2 | GET | `/api/v1/attachments/:externalId` | 첨부 메타 조회 | access + unlock | 위장 |
| 3 | GET | `/api/v1/attachments/:externalId/download-url` | 다운로드용 presigned URL 발급 | access + unlock | 위장 |

---

## 3. 공통 응답 포맷

development_conventions §4-3 (위장). 모든 거부:

```json
{
  "success": false,
  "error": { "code": "NEWS_ARTICLE_NOT_FOUND", "message": "기사를 찾을 수 없습니다.", "traceId": "uuid" },
  "meta": { "timestamp": "..." }
}
```

---

## 4. 엔드포인트 상세

### 4-1. 첨부 업로드

**메서드 + URL**: `POST /api/v1/attachments`

**Content-Type**: `multipart/form-data`

**설명**: 채팅 메시지 전송 전에 첨부파일을 업로드한다 (REQ-018). 업로드 완료 후 status = `PENDING` (message_id NULL). 이후 메시지 전송 (`POST /messages` with `attachmentExternalId`) 시점에 `AVAILABLE` 로 전이 + message_id 연결 (message 도메인 §4-1).

**인증**: access + unlock

**권한**: agent — 본인 활성 PAIRED 페어 보유자만 업로드 가능 (permission_policy §4-1-2 "첨부 업로드")

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)
- `Idempotency-Key: <uuid>` (필수)
- `Content-Type: multipart/form-data; boundary=...`

**Form Fields**:
- `file`: binary (필수) — 단일 파일. multipart part

**처리 흐름**:
1. JwtAuthGuard + UnlockTokenGuard. 위반 시 위장 404
2. 활성 PAIRED 페어 조회: `pairings WHERE (requester_agent_id=req.user.agentId OR recipient_agent_id=req.user.agentId) AND status='PAIRED' AND deleted_at IS NULL`
3. 미존재 → 위장 404 (페어 없는 사용자의 첨부 업로드 차단)
4. multipart 파싱. 파일 part 없음 → 위장 404
5. 파일 헤더의 declared `Content-Type` 추출. allow-list 4종 외 → 위장 404
6. 파일 사이즈 검증:
   - image/* → 10MB 이하
   - application/pdf → 25MB 이하
   - 초과 → 위장 404 (multipart streaming 중 break)
7. 매직바이트 검증 (스트림 첫 64B sniff):
   - `image/jpeg`: `FF D8 FF`
   - `image/png`: `89 50 4E 47 0D 0A 1A 0A`
   - `image/webp`: `52 49 46 46 ... 57 45 42 50` (RIFF + WEBP)
   - `application/pdf`: `25 50 44 46` (`%PDF`)
   - declared MIME 과 불일치 → 위장 404
8. MinIO 업로드:
   - storage_key = `uuid-v4` (랜덤 생성. 외부 노출 안 됨)
   - `s3Client.putObject({ Bucket: MINIO_BUCKET, Key: storage_key, Body: stream, ContentType: mime })`
   - 실패 시 위장 404 (또는 500 — 운영 결정. 권장: 위장 404 + 내부 알람)
9. 트랜잭션:
   - `INSERT INTO message_attachments (external_id, message_id=NULL, uploader_agent_id, status='PENDING', storage_key, mime_type, file_size_bytes, original_filename, magic_byte_verified=true) RETURNING external_id`
   - `INSERT INTO audit_logs (kind='ATTACHMENT_UPLOAD_START', actor_agent_id=?, target_type='attachment', target_id=?, target_external_id=?)`
10. 응답

**응답 (201 Created)**:
```json
{
  "success": true,
  "data": {
    "attachment": {
      "externalId": "uuid",
      "status": "PENDING",
      "mimeType": "image/jpeg",
      "fileSizeBytes": 245678,
      "originalFilename": "photo.jpg",
      "expiresAt": "2026-05-20T10:30:00.000Z"
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

`expiresAt` = `created_at + 30분`. 이 시간 내에 `POST /messages` 로 연결되지 않으면 worker 가 `DELETED` 처리 + MinIO 객체 정리 (db_design §9 / state_transition §9).

**에러**:
| 사유 | HTTP | 외부 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 |
| 페어 없음 | 404 | NEWS_ARTICLE_NOT_FOUND |
| 파일 미첨부 / 사이즈 초과 / MIME 위반 / 매직바이트 불일치 | 404 | NEWS_ARTICLE_NOT_FOUND |
| MinIO 업로드 실패 | 404 (위장) + 500 alert | NEWS_ARTICLE_NOT_FOUND (외부) / INTERNAL_ERROR (내부 알람) |
| Idempotency 누락 / 충돌 | 400 / 409 | (Idempotency 위장 적용 안 함) |

**부수효과**:
- MinIO 객체 적재 (storage_key)
- message_attachments INSERT (`PENDING`)
- audit_logs: `ATTACHMENT_UPLOAD_START`

---

### 4-2. 첨부 메타 조회

**메서드 + URL**: `GET /api/v1/attachments/:externalId`

**설명**: 첨부 메타 (mime, size, filename, status, message 연결 여부) 만 반환. 실제 파일 다운로드는 §4-3 사용.

**인증**: access + unlock

**권한**: 본인 페어의 첨부만 (혹은 PENDING 단계의 본인 uploader)

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)

**Path Parameters**:
- `externalId`: uuid (필수)

**처리 흐름**:
1. Guards
2. uuid 형식 검증. 위반 시 위장 404
3. `SELECT a.*, m.pairing_id FROM message_attachments a LEFT JOIN messages m ON m.id=a.message_id WHERE a.external_id=? LIMIT 1`
4. row 미존재 또는 `a.deleted_at IS NOT NULL` 또는 `a.status='DELETED'` → 위장 404
5. 권한 분기:
   - `a.status='PENDING'` 이면: `a.uploader_agent_id=req.user.agentId` 여야 함 (본인 업로드 중인 row 만 조회 가능). 불일치 → 위장 404
   - `a.status='AVAILABLE'` 이면: `a.message_id` 의 pairing 양측 (`requester_agent_id` 또는 `recipient_agent_id`) 중 본인이어야 함. 불일치 → 위장 404
6. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "attachment": {
      "externalId": "uuid",
      "status": "AVAILABLE",
      "mimeType": "image/jpeg",
      "fileSizeBytes": 245678,
      "originalFilename": "photo.jpg",
      "uploadedAt": "2026-05-20T10:00:00.000Z",
      "messageExternalId": "uuid (status=AVAILABLE 일 때만)"
    }
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**에러 (모두 위장 404)**:
| 사유 | HTTP | 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 |
| 형식 위반 / 미존재 / 삭제됨 / 권한 없음 | 404 | NEWS_ARTICLE_NOT_FOUND |

**부수효과**: 없음 (조회만, audit 미기록).

---

### 4-3. 다운로드 presigned URL 발급

**메서드 + URL**: `GET /api/v1/attachments/:externalId/download-url`

**설명**: 첨부의 MinIO presigned 다운로드 URL 을 발급한다. URL 은 30분 유효. presigned URL 자체에 storage_key 가 포함되지만 URL 단명 + IDOR 차단 (external_id 로 권한 검증 후 발급).

**인증**: access + unlock

**권한**: 본인 페어의 AVAILABLE 첨부만

**Request Headers**:
- `Authorization: Bearer <access>` (필수)
- `X-Unlock-Token: <unlock>` (필수)

**Path Parameters**:
- `externalId`: uuid (필수)

**처리 흐름**:
1. Guards
2. uuid 형식 검증. 위반 시 위장 404
3. `SELECT a.storage_key, a.mime_type, a.original_filename, a.status, m.pairing_id, p.requester_agent_id, p.recipient_agent_id FROM message_attachments a JOIN messages m ON m.id=a.message_id JOIN pairings p ON p.id=m.pairing_id WHERE a.external_id=? AND a.status='AVAILABLE' AND a.deleted_at IS NULL LIMIT 1`
4. 미존재 / PENDING / DELETED → 위장 404
5. `req.user.agentId NOT IN (p.requester_agent_id, p.recipient_agent_id)` → 위장 404
6. MinIO presigned URL 발급:
   ```typescript
   const url = await s3Client.getSignedUrl('getObject', {
     Bucket: MINIO_BUCKET,
     Key: storage_key,
     Expires: 1800, // 30분
     ResponseContentType: mime_type,
     ResponseContentDisposition: `attachment; filename="${sanitized_filename}"`
   });
   ```
7. 응답

**응답 (200 OK)**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://minio.example.com/news-bucket/uuid-storage-key?X-Amz-Algorithm=...&X-Amz-Expires=1800&...",
    "expiresAt": "2026-05-20T10:30:00.000Z",
    "mimeType": "image/jpeg",
    "fileSizeBytes": 245678,
    "originalFilename": "photo.jpg"
  },
  "meta": { "timestamp": "...", "traceId": "..." }
}
```

**중요 — presigned URL 의 위장 한계**: presigned URL 자체는 MinIO 도메인이 노출되므로 외부 식별 가능. 위장 강화를 위해 운영 시점에 MinIO 를 도메인 마스킹 (`https://news-cdn.example.com/...`) reverse proxy 권장. v1 은 기본 MinIO endpoint 사용.

**에러 (모두 위장 404)**:
| 사유 | HTTP | 응답 |
|---|---|---|
| access/unlock 위반 | 401 / 404 | 위장 404 |
| 형식 위반 / 미존재 / 권한 없음 / 상태 위반 | 404 | NEWS_ARTICLE_NOT_FOUND |
| MinIO presign 실패 | 500 | INTERNAL_ERROR (내부 알람) |

**부수효과**: 없음 (URL 발급은 stateless, audit 미기록 — 빈번).

---

## 5. 권한 정합 (G3)

| 엔드포인트 | permission_policy 항목 | 일치 |
|---|---|---|
| POST /attachments | "첨부 업로드" — PAIRED + unlock | ✓ |
| GET /attachments/:externalId | message_attachments 조회 — 본인 페어 또는 본인 PENDING | ✓ |
| GET /attachments/:externalId/download-url | "첨부 다운로드" — 본인 페어 + unlock + presigned URL 30분 | ✓ |

수정 / 사용자 삭제 endpoint 없음 → permission_policy "메시지 수정 / 삭제 — 미지원" 과 정합.

---

## 6. DB 매핑 (G4)

| 엔드포인트 | 읽기 / 쓰기 |
|---|---|
| POST /attachments | R: pairings. W: message_attachments (status=PENDING), audit_logs. + MinIO PUT |
| GET /attachments/:externalId | R: message_attachments, messages, pairings |
| GET /attachments/:externalId/download-url | R: message_attachments, messages, pairings. + MinIO presign |

상태 매핑:
- message_attachments.status: `(없음)` → `PENDING` (4-1)
- `PENDING` → `AVAILABLE` 는 message 도메인 (`POST /messages`) 의 책임 (message §4-1 트랜잭션 안에서)
- `PENDING` → `DELETED` (30분 미연결) / `AVAILABLE` → `DELETED` (90일 / 페어 해제) 는 worker / pairings disconnect

---

## 7. MinIO 어댑터 사양

### 7-1. 버킷 / 키 정책

- 단일 버킷 `MINIO_BUCKET` (예: `news-cdn`)
- 버킷 access policy = private (presigned URL 만 외부 접근 허용)
- 객체 key = `attachments/{external_id}` 또는 단순 `{uuid-v4}` (v1 = uuid-v4)
- 객체 metadata: `mime_type`, `original_filename` 저장 (선택)

### 7-2. lifecycle 정책

- 90일 만료 객체 자동 삭제는 application worker 가 처리 (MinIO ILM 룰 사용 안 함 — 메타 row 동기화 보장 위해)
- 페어 해제 시 worker 가 storage_key 리스트 받아 `deleteObjects` batch 호출

### 7-3. SDK

`@aws-sdk/client-s3` v3 (TypeORM-friendly, async/await). endpoint = `MINIO_ENDPOINT` 환경변수. forcePathStyle = true.

---

## 8. 위장 / 보안 강화 사항

1. **모든 거부 = 위장 404**: 형식 위반 / 미존재 / 권한 없음 / 상태 위반 모두 외부 식별 불가
2. **매직바이트 검증 강제**: declared MIME 만 신뢰 X. 실제 파일 시그니처 검사 (SEC-007)
3. **MIME allow-list 4종 고정**: image/jpeg, image/png, image/webp, application/pdf (db_design §4-9 CHECK)
4. **사이즈 분기**: image 10MB / PDF 25MB. 초과 시 multipart streaming 중 break
5. **storage_key 외부 노출 금지**: 모든 외부 API 응답에 storage_key 미포함. external_id 만
6. **presigned URL 30분 만료**: REQ-019 acceptance
7. **PENDING 30분 만료 자동 정리**: 고아 객체 누적 차단 (워커)
8. **첨부 사용자 명시 삭제 미지원**: audit 보존 정책 (자동 삭제만)
9. **MinIO 객체 hard delete**: 페어 해제 / 90일 만료 시 row + 객체 모두 hard delete (DB soft 후 worker hard)
10. **filename sanitization**: presigned URL 발급 시 `Content-Disposition` 헤더의 filename 은 path traversal / 특수문자 제거 (`/\\`)

---

## 9. 흐름 다이어그램 (참고)

### 9-1. 업로드 + 메시지 전송 happy path

```
1. RN: POST /attachments (multipart)        → 201 PENDING + externalId
2. RN: POST /messages { body, attachmentExternalId }
                                            → 201 SENT + attachment AVAILABLE
3. 페어 상대: WebSocket message:new (body + attachment 메타)
4. 페어 상대: GET /attachments/:externalId/download-url
                                            → 200 presigned URL
5. 페어 상대 RN: presigned URL 로 image 직접 다운로드 (MinIO)
```

### 9-2. 30분 내 연결 안 함 (사용자 취소)

```
1. POST /attachments → 201 PENDING
2. 사용자 화면 닫음 / 메시지 전송 안 함
3. 30분 후 worker: PENDING + created_at < now()-30m → DELETED + MinIO 객체 정리
```

### 9-3. 페어 해제 cascade

```
pairings.status PAIRED → DISCONNECTED (pairing 도메인 §4-6)
  ↓ 동일 트랜잭션
messages soft delete + message_attachments soft delete (storage_key 리스트 수집)
  ↓ commit 후
worker: MinIO deleteObjects([storage_keys])
```

---

## 전제 / 우선순위 적용

- **모든 거부 위장 404**: 채팅 모드 외 호출 가능성 0 — 위장 깨질 위험 큼
- **MIME / 사이즈 / 매직바이트 3중 검증**: SEC-007 / REQ-018 정합
- **사용자 명시 삭제 미지원**: brief / requirements_spec 명시. 자동만
- **MinIO 도메인 마스킹 v2**: v1 = 기본 MinIO endpoint, 운영 위장 강화 시 reverse proxy
- **PUT 미사용**
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-ATTACHMENT_
