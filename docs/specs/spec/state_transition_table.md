# agentNews 상태 전이표 v1.0

---

## 1. 문서 목적

본 문서는 status_values_final.md 가 정의한 7개 상태축의 모든 합법 전이와 금지 전이를 정의한다.
각 전이는 "수행자(actor)" 와 "자동/수동" 구분을 포함한다. 수행자는 permission_policy.md 의 사용자 유형과 일치해야 한다 (G3 게이트).

PLAN-003 의 단일 사용자 유형 = **에이전트(agent)**. 본 문서의 모든 수행자는 다음 중 하나다:
- `agent` (현재 row 의 본인 — 에이전트 본인 액션)
- `agent (counterpart)` (페어 상대 에이전트 액션)
- `system` (스케줄러 / 트리거 / 자동 처리)
- `external` (FCM / MinIO / 이메일 등 외부 시스템)

---

## 2. 에이전트 상태 (agents.status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 미존재) | 이메일+비밀번호 회원가입 성공 | `ACTIVE` | agent | 수동 | audit: USER_SIGNUP. REQ-001 |
| `ACTIVE` | 본인 탈퇴 요청 | `DELETED` | agent | 수동 | audit: USER_DELETE. deleted_at 기록 (soft delete) |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `DELETED` → `ACTIVE` | soft delete 후 복구 불가. 신규 가입 필요 |
| `ACTIVE` → `ACTIVE` | self-loop 무의미 |

### 해석 원칙

- 가입은 row 신규 생성 시점에 `ACTIVE` 로 진입 (`NOT_REGISTERED` 시퀀스 동반 생성)
- 로그아웃은 사용자 상태 전이가 아님 — JWT 무효화만 처리 (Unlock 세션 / refresh token 무효화)

---

## 3. 비밀 시퀀스 등록 상태 (agents.sequence_status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 신규 생성 시) | 회원가입 동반 생성 | `NOT_REGISTERED` | system | 자동 | agents row 생성 시 동일 트랜잭션 |
| `NOT_REGISTERED` | 시퀀스 등록 API 호출 (길이 4~6 검증 통과) | `REGISTERED` | agent | 수동 | audit: SEQUENCE_REGISTER. HMAC-SHA256 hash 저장. REQ-006 |
| `REGISTERED` | 시퀀스 변경 API (현재 시퀀스 재입력 검증 통과) | `REGISTERED` | agent | 수동 | audit: SEQUENCE_CHANGE. 해시 갱신 (self-loop 허용) |
| `REGISTERED` | 분실 복구 reset 링크 발송 | `RESET_PENDING` | agent | 수동 | audit: SEQUENCE_RESET_REQUEST. 이메일 발송. REQ-008 |
| `RESET_PENDING` | reset 링크 클릭 + 새 시퀀스 등록 | `REGISTERED` | agent | 수동 | audit: SEQUENCE_RESET_COMPLETE |
| `RESET_PENDING` | reset 링크 30분 만료 | `REGISTERED` | system | 자동 | 직전 상태(REGISTERED) 로 복귀. 기존 해시 유지 |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `NOT_REGISTERED` → `RESET_PENDING` | 등록 안 된 시퀀스의 reset 은 무의미. 등록 API 사용 |
| `REGISTERED` → `NOT_REGISTERED` | reset 완료 후도 즉시 새 해시로 REGISTERED 진입. 빈 상태 노출 금지 |
| `RESET_PENDING` → `NOT_REGISTERED` | 위와 동일 |

### 해석 원칙

- `RESET_PENDING` 동안에도 채팅 진입은 기존 시퀀스로 가능 (분실 복구 흐름 도중 페어 유지 정책 — REQ-008 acceptance)
- reset 완료까지 채팅 진입 불가 조건은 reset 링크 클릭 *이후* 새 시퀀스 등록 완료까지의 짧은 구간에 해당 (REQ-008 acceptance)

---

## 4. Unlock 세션 상태 (unlock_sessions.status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 미존재) | 시퀀스 검증 성공 (REGISTERED 상태 + 정확한 입력) | `ACTIVE` | agent | 수동 | audit: UNLOCK_SUCCESS. unlock_token 발급, 30분 TTL. 기존 ACTIVE row 가 있으면 REVOKED 로 먼저 종료 후 신규. REQ-007 |
| `ACTIVE` | 발급 후 30분 경과 | `EXPIRED` | system | 자동 | 스케줄러 또는 lazy check on API call. 채팅 API 401 응답 |
| `ACTIVE` | 앱 백그라운드 진입 후 5초 경과 (앱 → BE ping) | `REVOKED` | agent | 자동 | audit: UNLOCK_BACKGROUND. REQ-023 |
| `ACTIVE` | 앱 재시작 / 명시 로그아웃 / 시퀀스 reset 완료 | `REVOKED` | agent | 수동 | audit: UNLOCK_REVOKE. REQ-024 |
| `ACTIVE` | 페어 해제 (DISCONNECTED) | `REVOKED` | system | 자동 | 페어 없는 unlock 무의미 — 양측 모두 REVOKED |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `EXPIRED` → `ACTIVE` | 만료 후 재발급 금지. 새 시퀀스 검증 필요 |
| `REVOKED` → `ACTIVE` | 위와 동일 |
| `EXPIRED` ↔ `REVOKED` | 두 종료 상태 간 전이 무의미 |

### 해석 원칙

- 1 에이전트 = 동시 1 ACTIVE row (UNIQUE constraint, agent_id WHERE status='ACTIVE')
- 신규 unlock 발급 시 기존 ACTIVE 가 있으면 `REVOKED` 처리 후 신규 row 생성

---

## 5. 페어링 상태 (pairings.status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 미존재) | 페어링 요청 발송 (1 active pair 제약 통과) | `PAIRING_REQUESTED` | agent (requester) | 수동 | audit: PAIRING_REQUEST. 위장 푸시 큐잉. REQ-011 |
| `PAIRING_REQUESTED` | 수신자가 수락 | `PAIRED` | agent (counterpart) | 수동 | audit: PAIRING_ACCEPT. WebSocket 채널 활성. Idempotency-Key. REQ-012 |
| `PAIRING_REQUESTED` | 수신자가 거부 | `PAIRING_REJECTED` | agent (counterpart) | 수동 | audit: PAIRING_REJECT. 요청자에게 위장 푸시 통지. REQ-012 |
| `PAIRING_REQUESTED` | 요청자 본인 취소 | `DISCONNECTED` | agent (requester) | 수동 | audit: PAIRING_CANCEL. 활성 페어 슬롯 해제 |
| `PAIRED` | 양측 중 일방이 해제 요청 | `DISCONNECTED` | agent | 수동 | audit: PAIRING_DISCONNECT. 양측 메시지/첨부 즉시 hard delete. unlock 세션 REVOKED. REQ-013 |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `PAIRING_REQUESTED` → `PAIRING_REQUESTED` | 동일 요청 재발송 금지 (Idempotency-Key 로 차단) |
| `PAIRING_REJECTED` → 모든 상태 | 종료 상태. 새 페어링은 신규 row 생성 |
| `DISCONNECTED` → 모든 상태 | 종료 상태. 동일 |
| `PAIRED` → `PAIRING_REQUESTED` | 페어 후 재요청 무의미 |
| `PAIRED` → `PAIRING_REJECTED` | 이미 수락 완료 |

### 해석 원칙

- **1 active pair 제약 (REQ-014)**: agent 1인당 `PAIRING_REQUESTED` ∨ `PAIRED` 상태 row 최대 1개. DB constraint = `UNIQUE PARTIAL INDEX ON (agent_a_id) WHERE status IN ('PAIRING_REQUESTED','PAIRED')` + 동일 (agent_b_id)
- **이메일 검색 차단**: 검색 키는 `external_id` (uuid) 만 (REQ-010)
- 종료 상태(`PAIRING_REJECTED`, `DISCONNECTED`) row 는 audit 보존 위해 soft delete (deleted_at 기록)

---

## 6. 메시지 상태 (messages.status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 미존재) | 메시지 전송 API 호출 (PAIRED + unlock_token 유효) | `SENT` | agent | 수동 | audit: MESSAGE_SEND. 본문 AES-256-GCM 암호화 저장. WebSocket 으로 페어에게 즉시 푸시. notification_queue 등록. REQ-016 |
| `SENT` | 90일 경과 (created_at + 90d < now) | `DELETED` | system | 자동 | 배치 스케줄러. soft delete (deleted_at). REQ-017 |
| `SENT` | 페어 `DISCONNECTED` 전이 | `DELETED` | system | 자동 | 페어 해제 cascade. 동일 트랜잭션 내 메시지 + 첨부 일괄 처리. REQ-013, REQ-017 |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `DELETED` → `SENT` | 종료 상태 복원 불가 |
| `SENT` → `SENT` | 메시지 본문 수정 금지 (audit 보존) |

### 해석 원칙

- READ / DELIVERED receipt 미도입 (v1 범위 밖)
- `DELETED` 후 클라이언트에 표시 안 함. 단 row 자체는 audit 보존 위해 잔존 (실제 본문은 redacted 처리 가능 — db_design 에서 확정)

---

## 7. 첨부파일 상태 (message_attachments.status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 미존재) | 첨부 업로드 시작 (presigned upload URL 발급) | `PENDING` | agent | 수동 | audit: ATTACHMENT_UPLOAD_START. message_id NULL 허용. REQ-018 |
| `PENDING` | MinIO 업로드 완료 + 매직바이트 검증 통과 + message_id 연결 | `AVAILABLE` | agent | 수동 | audit: ATTACHMENT_AVAILABLE. CHECK 제약: status='AVAILABLE' → message_id NOT NULL. REQ-018 |
| `PENDING` | 30분 내 업로드 미완료 또는 매직바이트 검증 실패 | `DELETED` | system | 자동 | 고아 row 정리 배치. MinIO 임시 객체 삭제 |
| `AVAILABLE` | 90일 경과 또는 페어 `DISCONNECTED` 전이 | `DELETED` | system | 자동 | MinIO 에서 hard delete. REQ-020 |
| `AVAILABLE` | 메시지 `DELETED` cascade | `DELETED` | system | 자동 | 위와 동일 |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `AVAILABLE` → `PENDING` | 업로드 완료 후 되돌림 금지 |
| `DELETED` → 모든 상태 | 종료 상태 |
| `PENDING` → `DELETED` (사용자 액션) | 사용자 명시 삭제는 메시지 전송 후 가능. PENDING 단계는 자동 정리만 |

### 해석 원칙

- presigned upload URL 30분 만료 후 `PENDING` 잔존 시 자동 `DELETED`
- MIME 5종(image/jpeg, image/png, image/webp, application/pdf) 검증은 PENDING → AVAILABLE 전이 조건

---

## 8. 위장 푸시 알림 상태 (notification_queue.status) 전이 규칙

### 전이 규칙

| 현재 상태 | 이벤트 / 조건 | 다음 상태 | 수행자 | 자동/수동 | 비고 |
|---|---|---|---|---|---|
| (row 미존재) | 알림 트리거 이벤트 (메시지 SENT / 페어링 요청 / 페어링 거부) | `QUEUED` | system | 자동 | jitter 0~60s 무작위 발송 시각 결정. REQ-022 |
| `QUEUED` | jitter 만료 + FCM 발송 성공 | `SENT` | external (FCM) | 자동 | data payload=0, 위장 헤드라인 본문. REQ-021 |
| `QUEUED` | jitter 만료 + FCM 발송 실패 (토큰 만료 등) | `FAILED` | external (FCM) | 자동 | audit: NOTIFICATION_FAIL. 재시도는 새 row 생성 |

### 전이 금지

| 금지 전이 | 사유 |
|---|---|
| `SENT` → 모든 상태 | 종료 상태 |
| `FAILED` → 모든 상태 | 종료 상태. 재시도는 새 row |
| `QUEUED` → `QUEUED` | self-loop 금지 (jitter 재계산 금지) |

### 해석 원칙

- FCM 의 ack 만 신뢰. OS 레벨 도착은 추적 안 함
- 알림 트리거는 3종: (1) 메시지 SENT, (2) 페어링 요청 PAIRING_REQUESTED, (3) 페어링 거부 PAIRING_REJECTED. 각 트리거마다 위장 카피 분기 (텍스트/사진/PDF/요청/거부)

---

## 9. 자동 전환 정책 요약

| 자동 전환 | 트리거 | 주기 |
|---|---|---|
| Unlock 세션 ACTIVE → EXPIRED | unlock_token 30분 만료 | lazy check on API call + 5분 배치 |
| Unlock 세션 ACTIVE → REVOKED (백그라운드) | 앱 → BE ping (5초 경과 알림) | 이벤트 기반 |
| 시퀀스 RESET_PENDING → REGISTERED (만료) | reset 링크 30분 만료 | 5분 배치 |
| 메시지 SENT → DELETED (90일) | created_at + 90d < now | 일배치 (자정) |
| 첨부 PENDING → DELETED (고아) | created_at + 30분 < now AND status='PENDING' | 5분 배치 |
| 첨부 AVAILABLE → DELETED (90일) | created_at + 90d < now | 일배치 (자정) |
| 페어 cascade 삭제 | pairings.status → DISCONNECTED | 동일 트랜잭션 |
| 위장 푸시 QUEUED → SENT/FAILED | jitter 만료 시 발송 시도 | 이벤트 기반 (worker) |

---

## 10. 감사 로그 필요 전이 (audit_logs append-only)

다음 전이는 `audit_logs` 에 1 row 기록 필수 (REQ-025):

| 이벤트 kind | 발생 전이 |
|---|---|
| `USER_SIGNUP` | (없음) → agents.status=ACTIVE |
| `USER_DELETE` | agents.status: ACTIVE → DELETED |
| `LOGIN_SUCCESS` | 로그인 성공 (상태 전이 외 이벤트) |
| `LOGIN_FAIL` | 로그인 실패 (상태 전이 외 이벤트) |
| `SEQUENCE_REGISTER` | sequence_status: NOT_REGISTERED → REGISTERED |
| `SEQUENCE_CHANGE` | sequence_status: REGISTERED → REGISTERED (해시 갱신) |
| `SEQUENCE_RESET_REQUEST` | sequence_status: REGISTERED → RESET_PENDING |
| `SEQUENCE_RESET_COMPLETE` | sequence_status: RESET_PENDING → REGISTERED |
| `UNLOCK_SUCCESS` | unlock_sessions: (없음) → ACTIVE |
| `UNLOCK_FAIL` | 시퀀스 검증 실패 (상태 전이 외 이벤트, 위장 유지 위해 외부 응답은 정상 200) |
| `UNLOCK_BACKGROUND` | unlock_sessions: ACTIVE → REVOKED (백그라운드 5초) |
| `UNLOCK_REVOKE` | unlock_sessions: ACTIVE → REVOKED (명시 로그아웃 등) |
| `PAIRING_REQUEST` | pairings: (없음) → PAIRING_REQUESTED |
| `PAIRING_ACCEPT` | pairings: PAIRING_REQUESTED → PAIRED |
| `PAIRING_REJECT` | pairings: PAIRING_REQUESTED → PAIRING_REJECTED |
| `PAIRING_CANCEL` | pairings: PAIRING_REQUESTED → DISCONNECTED (요청자 취소) |
| `PAIRING_DISCONNECT` | pairings: PAIRED → DISCONNECTED |
| `MESSAGE_SEND` | messages: (없음) → SENT |
| `MESSAGE_DELETE` | messages: SENT → DELETED (90일 또는 페어 해제) |
| `ATTACHMENT_UPLOAD_START` | message_attachments: (없음) → PENDING |
| `ATTACHMENT_AVAILABLE` | message_attachments: PENDING → AVAILABLE |
| `ATTACHMENT_DELETE` | message_attachments: AVAILABLE → DELETED |
| `NOTIFICATION_FAIL` | notification_queue: QUEUED → FAILED |

---

## 11. G2 게이트 자가 검증

status_values_final.md 의 21개 상태가 모두 본 전이표에 등장하는지 검증:

| 상태축 | 상태값 | 등장 (현재 또는 다음) |
|---|---|---|
| agents.status | `ACTIVE` | §2 (다음/현재) ✓ |
| agents.status | `DELETED` | §2 (다음) ✓ |
| agents.sequence_status | `NOT_REGISTERED` | §3 (다음/현재) ✓ |
| agents.sequence_status | `REGISTERED` | §3 (다음/현재) ✓ |
| agents.sequence_status | `RESET_PENDING` | §3 (다음/현재) ✓ |
| unlock_sessions.status | `ACTIVE` | §4 (다음/현재) ✓ |
| unlock_sessions.status | `EXPIRED` | §4 (다음) ✓ |
| unlock_sessions.status | `REVOKED` | §4 (다음) ✓ |
| pairings.status | `PAIRING_REQUESTED` | §5 (다음/현재) ✓ |
| pairings.status | `PAIRED` | §5 (다음/현재) ✓ |
| pairings.status | `PAIRING_REJECTED` | §5 (다음) ✓ |
| pairings.status | `DISCONNECTED` | §5 (다음) ✓ |
| messages.status | `SENT` | §6 (다음/현재) ✓ |
| messages.status | `DELETED` | §6 (다음) ✓ |
| message_attachments.status | `PENDING` | §7 (다음/현재) ✓ |
| message_attachments.status | `AVAILABLE` | §7 (다음/현재) ✓ |
| message_attachments.status | `DELETED` | §7 (다음) ✓ |
| notification_queue.status | `QUEUED` | §8 (다음/현재) ✓ |
| notification_queue.status | `SENT` | §8 (다음) ✓ |
| notification_queue.status | `FAILED` | §8 (다음) ✓ |

총 21개 상태 모두 등장. **G2 게이트 충족**.

---

## 전제 / 우선순위 적용

- 본 문서는 status_values_final.md v1.0 의 상태값만 사용. 신규 상태값 도입 금지
- 수행자 표기 `agent` / `agent (counterpart)` / `system` / `external` 는 permission_policy.md 의 사용자 유형과 1:1 매핑 (G3 게이트)
- 위장 유지 원칙: UNLOCK_FAIL 등 권한 거부 audit 는 *내부* 기록일 뿐, 외부 응답은 일반 뉴스 응답과 구분 불가 (REQ-009, SEC-006)
- 우선순위: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-STATE-TRANSITION_
