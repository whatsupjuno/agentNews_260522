# agentNews 상태값 확정안 v1.0

---

## 1. 문서 목적

본 문서는 agentNews v1 의 모든 상태 라이프사이클을 단일 카탈로그로 정의한다.
이후 state_transition_table, db_design, ddl, api_specs 는 본 문서의 상태값만 인용한다.

본 문서에서 정의하는 상태는 아래 7개 축이다.

1. **에이전트 상태** (agents.status)
2. **비밀 시퀀스 등록 상태** (agents.sequence_status)
3. **Unlock 세션 상태** (unlock_sessions.status)
4. **페어링 상태** (pairings.status)
5. **메시지 상태** (messages.status)
6. **첨부파일 상태** (message_attachments.status)
7. **위장 푸시 알림 상태** (notification_queue.status)

명명: 모두 `SCREAMING_SNAKE_CASE`. 초기 / 종료 상태는 표의 마지막 컬럼에 표기.

---

## 2. 에이전트 상태 (agents.status)

### 2-1. 상태값

- `ACTIVE`
- `DELETED`

### 2-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `ACTIVE` | 가입 완료 후 정상 사용 가능 (이메일 인증 자유 가입) | 초기 |
| `DELETED` | 계정 탈퇴 후 soft delete (deleted_at 기록) | 종료 |

**비고**: PLAN-003 단일 사용자 유형 (에이전트). admin/anonymous 는 v1 범위 밖. 시퀀스 5회 실패 LOCKED_OUT 은 PLAN-003 에 도입 안 함 (REQ-007 의 rate limit 만 적용, intake G-1).

---

## 3. 비밀 시퀀스 등록 상태 (agents.sequence_status)

### 3-1. 상태값

- `NOT_REGISTERED`
- `REGISTERED`
- `RESET_PENDING`

### 3-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `NOT_REGISTERED` | 가입 직후 시퀀스 미등록 상태. 채팅 진입 불가 | 초기 |
| `REGISTERED` | 시퀀스 등록 완료 (HMAC-SHA256 hash + 16B salt 저장) | - |
| `RESET_PENDING` | 이메일 reset 링크 발송 후 재등록 대기 (30분 유효) | - |

**비고**: REQ-006 (등록), REQ-008 (분실 복구) 기반. RESET_PENDING → 재등록 완료 시 REGISTERED 로 복귀. RESET_PENDING 의 30분 타임아웃 만료 시 자동으로 직전 상태로 복귀 (state_transition 에서 정의).

---

## 4. Unlock 세션 상태 (unlock_sessions.status)

### 4-1. 상태값

- `ACTIVE`
- `EXPIRED`
- `REVOKED`

### 4-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `ACTIVE` | 시퀀스 검증 성공 → unlock_token 발급 직후. 30분 유효 | 초기 |
| `EXPIRED` | unlock_token 발급 후 30분 경과 (자연 만료) | 종료 |
| `REVOKED` | 앱 재시작 / 백그라운드 5초+ / 로그아웃 등으로 명시 무효화 | 종료 |

**비고**: REQ-007 (시퀀스 검증), REQ-023 (백그라운드 5초 자동 종료), REQ-024 (앱 재시작 시 무효화) 기반. unlock_sessions 테이블은 1 에이전트 = 최대 1 ACTIVE row (UNIQUE constraint).

---

## 5. 페어링 상태 (pairings.status)

### 5-1. 상태값

- `PAIRING_REQUESTED`
- `PAIRED`
- `PAIRING_REJECTED`
- `DISCONNECTED`

### 5-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `PAIRING_REQUESTED` | 발신자가 요청 발송, 수신자 응답 대기 (위장 푸시로 통지) | 초기 |
| `PAIRED` | 수신자가 요청 수락. 채팅 채널 활성화 | - |
| `PAIRING_REJECTED` | 수신자가 요청 거부. 요청자에게 위장 푸시로 통지 | 종료 |
| `DISCONNECTED` | 양측 중 일방이 해제. 메시지/첨부 즉시 hard delete | 종료 |

**비고**:
- REQ-011 (요청), REQ-012 (수락/거부), REQ-013 (해제) 기반
- "활성 페어" = (`PAIRING_REQUESTED` ∨ `PAIRED`) — REQ-014 의 1 active pair 제약은 이 두 상태 합집합에 적용
- 본 문서에 `NONE` 상태값은 정의하지 않음. 페어링 row 미존재 = 페어 없음 (테이블 진입 전). pairings 테이블에 row 가 생성되는 최초 시점이 `PAIRING_REQUESTED`
- 종료 상태(`PAIRING_REJECTED`, `DISCONNECTED`) 의 row 는 audit 목적상 soft delete (deleted_at) 로 유지

---

## 6. 메시지 상태 (messages.status)

### 6-1. 상태값

- `SENT`
- `DELETED`

### 6-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `SENT` | 메시지 전송 완료 (서버 저장). WebSocket 으로 수신자 즉시 전달 | 초기 |
| `DELETED` | 90일 자동 삭제 (soft delete, deleted_at) 또는 페어 해제 시 즉시 삭제 | 종료 |

**비고**:
- REQ-016 (전송/수신), REQ-017 (90일 보존) 기반
- READ / DELIVERED 등 receipt 상태는 v1 범위 밖 (brief 에 read receipt 명시 없음)
- 페어 해제(`DISCONNECTED`) 시 해당 페어의 모든 메시지가 즉시 `DELETED` 로 전이 + MinIO 첨부도 hard delete

---

## 7. 첨부파일 상태 (message_attachments.status)

### 7-1. 상태값

- `PENDING`
- `AVAILABLE`
- `DELETED`

### 7-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `PENDING` | 업로드 시작, MinIO 적재 진행 중. message_id NULL 허용 (message 이전 upload 가능) | 초기 |
| `AVAILABLE` | 업로드 완료 + 매직바이트 검증 통과. presigned URL 다운로드 가능 (30분) | - |
| `DELETED` | 90일 만료 또는 페어 해제 시 MinIO 에서 물리 삭제 완료 | 종료 |

**비고**:
- REQ-018 (업로드), REQ-019 (다운로드), REQ-020 (보존/삭제) 기반
- `AVAILABLE` 로의 전이 조건: `message_id IS NOT NULL` AND 매직바이트 검증 통과 (CHECK 제약)
- `DELETED` 는 hard delete 후 audit 용 메타 row 만 잔존하는 경우의 표시 (실제 운영은 row 완전 삭제 가능)

---

## 8. 위장 푸시 알림 상태 (notification_queue.status)

### 8-1. 상태값

- `QUEUED`
- `SENT`
- `FAILED`

### 8-2. 상태 정의

| 상태 | 정의 | 초기/종료 |
|---|---|---|
| `QUEUED` | 메시지 도착 후 jitter 대기열 등록 (0~60초 무작위 지연) | 초기 |
| `SENT` | jitter 만료 후 FCM 발송 성공 (data payload = 0, 위장 헤드라인 본문) | 종료 |
| `FAILED` | FCM 발송 오류 (토큰 만료 등). 재시도 정책은 백오프 기반 (운영) | 종료 |

**비고**:
- REQ-021 (위장 푸시), REQ-022 (jitter) 기반
- `SENT` 후의 OS 레벨 알림 도착 여부는 추적 안 함 (FCM 의 ack 만 신뢰)
- `FAILED` 도 종료 상태로 분류 (재시도는 새 row 생성 정책 — DDL 단계에서 확정)

---

## 9. 명명 규칙

- 모든 상태값은 `SCREAMING_SNAKE_CASE`
- 부정/긍정 명확 (`ACTIVE` vs `DELETED`, `PAIRED` vs `PAIRING_REJECTED`)
- 자동 생성 상태 (`QUEUED`, `PENDING`) vs 사용자 액션 결과 (`PAIRING_REJECTED`, `DISCONNECTED`) 구분
- 시제 명시 (`REQUESTED`, `REJECTED` 등 과거형으로 액션 완료 표시)
- 단일 컬럼 1 상태 — 복합 상태(예: `PAIRED_AND_DISCONNECTED`) 금지

---

## 10. 상태 ↔ 요구사항 매핑

| 상태축 | 관련 REQ |
|---|---|
| 에이전트 상태 | REQ-001, REQ-003 |
| 비밀 시퀀스 등록 상태 | REQ-006, REQ-008 |
| Unlock 세션 상태 | REQ-007, REQ-009, REQ-023, REQ-024 |
| 페어링 상태 | REQ-010, REQ-011, REQ-012, REQ-013, REQ-014 |
| 메시지 상태 | REQ-016, REQ-017 |
| 첨부파일 상태 | REQ-018, REQ-019, REQ-020 |
| 위장 푸시 알림 상태 | REQ-021, REQ-022 |

requirements_spec.md 의 모든 라이프사이클 REQ 가 위 7개 축 중 하나 이상에 매핑됨 (G2 게이트 충족).

---

## 전제 / 우선순위 적용

- **사용자 유형**: 단일 (에이전트). brief §3 + intake §1 + requirements_spec §4 기준. PLAN-001/002 DECISIONS 의 3종(anonymous/agent/admin) 은 PLAN-003 brief 가 명시 변경.
- **LOCKED_OUT 미도입**: PLAN-002 의 시퀀스 5회 실패 → 10분 LOCKED_OUT 정책은 PLAN-003 intake G-1 (`시퀀스 실패 카운터 무한, rate limit 만 적용`) 으로 폐기. 본 문서는 PLAN-003 intake 우선.
- **NONE 상태 미정의**: pairings 의 "페어 없음" 은 row 미존재로 표현. 빈 row 만들지 않음.
- **READ/DELIVERED 미도입**: brief 에 read receipt 명시 없음 → v1 범위 밖.
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-STATUS-VALUES_
