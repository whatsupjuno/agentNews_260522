# audit_log API 명세서 v1.0

---

## 1. 개요

audit_log 도메인은 보안·운영 이벤트의 영구 기록을 담당한다. **PLAN-003 의 admin 화면·계정 미도입** 정책에 따라 본 도메인은 **외부 사용자 endpoint 가 없다** (permission_policy §4-1-1, dev_conventions §7-9). 운영자는 DB 에 직접 접근하여 조회한다.

본 문서는 다음을 정의한다:

1. **내부 AuditLogger 서비스 사양** — 모든 도메인이 호출하는 단일 진입점
2. **append-only DB 트리거 동작** (SEC-010)
3. **kind enum 카탈로그 전체** — state_transition §10 + 추가
4. **보존 정책 (1년)** + 일배치 정리
5. **운영 SQL 가이드** — 자주 쓰는 조회 쿼리 템플릿
6. **PII / 위장 응답 누설 방지 규칙**

| 사용자 유형 | 인증 방식 |
|---|---|
| 에이전트 (agent) | 외부 endpoint 없음 (조회 불가) |
| 운영자 | DB 직접 접근 (psql / pgcli, IP 화이트리스트) |

**공통 규칙**:
- audit_logs row 는 **append-only** — DB 트리거가 UPDATE / DELETE 차단 (SEC-010)
- 본문에 비밀번호 / 메시지 평문 / 시퀀스 평문 / JWT 토큰 평문 **절대 미포함** (dev_conventions §8)
- `actor_kind` = `agent` / `system` / `external` 중 1
- 외부 식별자 표기: `target_external_id` 컬럼에 uuid (internal bigint 노출 차단)
- 보존 1년 (NFR-003), 1년 + 30일 후 hard delete 배치

---

## 2. 외부 endpoint 목록

| # | 메서드 | URL | 설명 |
|---|---|---|---|
| - | - | - | **없음**. 운영자는 DB 직접 접근 (psql) |

PLAN-003 admin 계정 / 화면 미도입 (requirements_spec §4) 으로 사용자 endpoint 0개.

---

## 3. 내부 AuditLogger 서비스 사양 (`infrastructure/audit/AuditLogger`)

### 3-1. 인터페이스

```typescript
interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}

type AuditEvent = {
  kind: AuditKind;                          // §4 catalog
  actorAgentId: bigint | null;              // system/external 이면 null
  actorKind: 'agent' | 'system' | 'external';
  targetType?: string;                       // 'pairing' | 'message' | 'attachment' | ...
  targetId?: bigint;                         // internal id
  targetExternalId?: string;                 // uuid (외부 추적용)
  ipAddress?: string;                        // 'inet' compatible
  userAgent?: string;
  context?: Record<string, unknown>;         // jsonb
};
```

### 3-2. 트랜잭션 통합

- 호출자는 **현재 트랜잭션 안에서** `AuditLogger.log()` 호출 — UseCase 트랜잭션 commit 과 동시에 audit row commit
- NestJS DI 로 주입. 각 UseCase 가 명시적으로 호출 (자동 hook 안 함 — 누락 가능성 < 명시 호출의 명확성)
- 실패 시 트랜잭션 전체 롤백 (audit 미기록 = 운영 사고)

### 3-3. 호출 시점

state_transition_table.md §10 의 23종 + 추가 이벤트 (§4 참조) 각 발생 시 호출.

### 3-4. context 필드 PII 가드

`context` jsonb 에 다음 키 사용 금지 (코드 리뷰 + lint 검출):
- `password`, `passwordHash`, `password_hash`
- `messageBody`, `body`, `ciphertext`, `plaintext`
- `sequence`, `sequenceArray`, `sequence_plain`
- `jwt`, `accessToken`, `refreshToken`, `unlockToken`
- `fcmToken`

허용 키 예: `reason`, `attempt_length`, `mime_type`, `file_size_bytes`, `fcm_error`, `ip_change`.

### 3-5. 비동기 / 큐잉 금지

audit_logs INSERT 는 *반드시* 호출 UseCase 와 동일 트랜잭션. 큐잉 / 비동기 작성 금지 (commit 실패 시 audit 누락 위험).

예외: NotificationDispatchWorker 의 NOTIFICATION_FAIL audit 는 worker 자체 트랜잭션 안.

---

## 4. AuditKind 카탈로그 (전체)

ddl.sql audit_logs CHECK 의 enum 과 1:1 일치 (G4 정합).

| kind | 트리거 | actor_kind | target_type | 비고 |
|---|---|---|---|---|
| `USER_SIGNUP` | 회원가입 성공 | agent | agent | auth §4-1 |
| `USER_DELETE` | 계정 탈퇴 (soft delete) | agent | agent | user_management §4-3 |
| `LOGIN_SUCCESS` | 로그인 성공 | agent | agent | auth §4-2 |
| `LOGIN_FAIL` | 로그인 실패 / refresh 재사용 의심 | agent / system | agent (또는 null) | auth §4-2, §4-4 |
| `SEQUENCE_REGISTER` | 시퀀스 최초 등록 | agent | agent_secret_sequences | secret_unlock §4-1 |
| `SEQUENCE_CHANGE` | 시퀀스 변경 (해시 갱신) | agent | agent_secret_sequences | secret_unlock §4-2 |
| `SEQUENCE_RESET_REQUEST` | reset 링크 발송 | agent | agent_secret_sequences | secret_unlock §4-3 |
| `SEQUENCE_RESET_COMPLETE` | reset 완료 (재등록) | agent | agent_secret_sequences | secret_unlock §4-4 |
| `UNLOCK_SUCCESS` | 시퀀스 검증 성공 → unlock 발급 | agent | unlock_session | secret_unlock §4-5 |
| `UNLOCK_FAIL` | 시퀀스 검증 실패 (위장 응답이지만 내부 기록) | agent | agent_secret_sequences | secret_unlock §4-5 |
| `UNLOCK_BACKGROUND` | 백그라운드 5초+ 자동 REVOKE | system | unlock_session | secret_unlock §6 worker |
| `UNLOCK_REVOKE` | 명시 종료 (logout / app_restart / new_unlock / pair_disconnect) | agent / system | unlock_session | auth §4-3, secret_unlock §4-7 |
| `PAIRING_REQUEST` | 페어링 요청 발송 | agent | pairing | pairing §4-1 |
| `PAIRING_ACCEPT` | 수락 | agent | pairing | pairing §4-3 |
| `PAIRING_REJECT` | 거부 | agent | pairing | pairing §4-4 |
| `PAIRING_CANCEL` | 요청자 취소 | agent | pairing | pairing §4-5 |
| `PAIRING_DISCONNECT` | 해제 (PAIRED → DISCONNECTED) | agent | pairing | pairing §4-6 |
| `MESSAGE_SEND` | 메시지 전송 | agent | message | message §4-1 |
| `MESSAGE_DELETE` | 90일 만료 / 페어 해제 cascade | system | message | worker, pairing §4-6 |
| `ATTACHMENT_UPLOAD_START` | 업로드 시작 (PENDING) | agent | attachment | attachment §4-1 |
| `ATTACHMENT_AVAILABLE` | message 연결 (PENDING → AVAILABLE) | agent | attachment | message §4-1 |
| `ATTACHMENT_DELETE` | 90일 / 페어 해제 cascade | system | attachment | worker |
| `NOTIFICATION_FAIL` | FCM 발송 실패 | system / external | notification | notification §5-3 |

**총 23종** (ddl.sql audit_logs.kind CHECK 와 정확히 일치).

`UNLOCK_FAIL` 은 외부 응답이 위장 (HTTP 200 + 가짜 기사) 이지만 내부 audit 는 사실 기록 — 외부 단서 누설 없음.

---

## 5. append-only DB 트리거

### 5-1. 트리거 정의 (ddl.sql §2-13)

```sql
CREATE OR REPLACE FUNCTION raise_audit_immutable_error()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only — UPDATE/DELETE not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION raise_audit_immutable_error();
```

### 5-2. 동작

- INSERT: 허용
- UPDATE: 트리거가 예외 발생 → 트랜잭션 롤백
- DELETE: 트리거가 예외 발생 → 트랜잭션 롤백 — **단 보존 정책 배치(§7)는 예외 처리 필요**

### 5-3. 배치 hard delete 예외 처리

1년 + 30일 경과 row 정리 배치는 트리거를 일시 비활성화 후 DELETE:

```sql
-- 운영자 권한 (DB superuser)
BEGIN;
  ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable;
  DELETE FROM audit_logs WHERE occurred_at < now() - INTERVAL '395 days';   -- 365 + 30 buffer
  ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable;
COMMIT;
```

**중요**: 배치 권한은 운영자 (superuser) 만 보유. application DB user 는 트리거 비활성화 권한 없음.

---

## 6. 운영 SQL 가이드 (사용자 endpoint 대체)

운영자가 자주 쓰는 조회 쿼리.

### 6-1. 특정 agent 의 최근 24시간 활동

```sql
SELECT occurred_at, kind, actor_kind, target_type, target_external_id, context
FROM audit_logs
WHERE actor_agent_id = (SELECT id FROM agents WHERE external_id = '<uuid>' LIMIT 1)
  AND occurred_at > now() - INTERVAL '24 hours'
ORDER BY occurred_at DESC
LIMIT 100;
```

### 6-2. 로그인 실패 패턴 탐지 (24시간 ≥ 10건)

```sql
SELECT actor_agent_id, context->>'email' AS email, count(*) AS fail_count
FROM audit_logs
WHERE kind = 'LOGIN_FAIL'
  AND occurred_at > now() - INTERVAL '24 hours'
GROUP BY actor_agent_id, context->>'email'
HAVING count(*) >= 10
ORDER BY fail_count DESC;
```

### 6-3. 시퀀스 검증 실패 패턴

```sql
SELECT actor_agent_id, count(*) AS fail_count, max(occurred_at) AS last_fail
FROM audit_logs
WHERE kind = 'UNLOCK_FAIL'
  AND occurred_at > now() - INTERVAL '1 hour'
GROUP BY actor_agent_id
HAVING count(*) >= 20;
```

### 6-4. 특정 페어의 전체 lifecycle

```sql
SELECT occurred_at, kind, actor_kind, actor_agent_id, context
FROM audit_logs
WHERE target_type = 'pairing'
  AND target_external_id = '<pairing-uuid>'
ORDER BY occurred_at ASC;
```

### 6-5. FCM 발송 실패 24시간 추이

```sql
SELECT date_trunc('hour', occurred_at) AS hour,
       count(*) AS fail_count,
       count(DISTINCT (context->>'fcm_error')) AS unique_errors
FROM audit_logs
WHERE kind = 'NOTIFICATION_FAIL'
  AND occurred_at > now() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

### 6-6. 페어 해제 추이 (월 단위)

```sql
SELECT date_trunc('day', occurred_at) AS day,
       count(*) AS disconnect_count
FROM audit_logs
WHERE kind = 'PAIRING_DISCONNECT'
  AND occurred_at > now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 7. 보존 정책 (NFR-003)

| 항목 | 값 |
|---|---|
| 기본 보존 기간 | 1년 (`occurred_at + 365 days`) |
| 정리 buffer | 30일 (총 395일 후 hard delete) |
| 배치 주기 | 월 1회 (운영자 수동 또는 cron) |
| 권한 | DB superuser (application user 권한 없음) |
| 트리거 처리 | DISABLE → DELETE → ENABLE (단일 트랜잭션) |

운영 배치 SQL = §5-3.

---

## 8. PII / 위장 응답 누설 방지

### 8-1. context 누설 금지 키 (재확인 — §3-4)

코드 작성 / 리뷰 시점에 다음 키 사용 시 PR 차단:

```regex
\b(password|password[_]?hash|message[_]?body|body|ciphertext|plaintext|sequence|sequence[_]?array|sequence[_]?plain|jwt|access[_]?token|refresh[_]?token|unlock[_]?token|fcm[_]?token)\b
```

### 8-2. 외부 응답에 audit row 포함 금지

dev_conventions §4 의 모든 응답 (성공 / 실패 / 위장) 본문에 audit_logs row / id 포함 금지. 디버깅 정보는 `traceId` 만 (요청 trace, audit 와 별개).

### 8-3. UNLOCK_FAIL / LOGIN_FAIL 의 외부 응답

외부 응답 = 위장 (UNLOCK) 또는 일반 401 (LOGIN). 내부 audit 만 사실 기록. 외부에서 audit 존재 추적 불가.

### 8-4. context 의 IP / user_agent

운영 디버깅을 위해 `ip_address` (`inet`) 와 `user_agent` (varchar) 컬럼 저장. PII 이지만 audit 용도로 필요. 1년 보존 후 자동 삭제.

---

## 9. 운영 SOP — 보안 사고 발생 시

### 9-1. refresh 재사용 의심 (LOGIN_FAIL with reason=REFRESH_REUSE)

```sql
-- 1. 의심 agent 식별
SELECT actor_agent_id, occurred_at, context
FROM audit_logs
WHERE kind = 'LOGIN_FAIL' AND context->>'reason' = 'REFRESH_REUSE'
ORDER BY occurred_at DESC LIMIT 50;

-- 2. 해당 agent 의 모든 refresh 무효화 (이미 자동 처리됐어야 하지만 검증)
SELECT count(*) FROM refresh_tokens
WHERE agent_id = ? AND revoked_at IS NULL;
-- 0 이면 정상. > 0 이면 운영자가 수동 revoke
```

### 9-2. 첨부 매직바이트 위반 다수

```sql
SELECT actor_agent_id, count(*) FROM audit_logs
WHERE kind = 'ATTACHMENT_UPLOAD_START'
  AND context->>'reason' = 'MAGIC_BYTE_MISMATCH'
  AND occurred_at > now() - INTERVAL '1 day'
GROUP BY actor_agent_id
HAVING count(*) > 5;
```

### 9-3. WebSocket 비인가 이벤트 (SEC-005)

dev_conventions §7-8 의 client → server 이벤트는 핸들러 미등록. 만약 등록되거나 우회 시도가 발생하면 별도 audit kind (v1.1 권장: `WS_UNAUTHORIZED_EVENT`) 로 기록. v1 은 가능성 낮음 — 코드 리뷰 강화.

---

## 10. 권한 정합 (G3)

| 액션 | permission_policy 항목 | 일치 |
|---|---|---|
| audit_logs 조회 (사용자) | "audit_logs 조회 — 운영 직접 DB 접근만" | ✓ (외부 endpoint 0개) |
| audit_logs 기록 (system) | system 수행자 (§3 권한 검사 외) | ✓ |
| 보존 정책 hard delete (운영) | DB superuser | ✓ |

---

## 11. DB 매핑 (G4)

본 도메인은 외부 endpoint 가 없으므로 application user 의 W: audit_logs (INSERT only).

| 호출 위치 | INSERT |
|---|---|
| 모든 UseCase | audit_logs (kind 별 §4) |
| NotificationDispatchWorker | audit_logs (`NOTIFICATION_FAIL`) |
| UnlockBackgroundExpireWorker | audit_logs (`UNLOCK_BACKGROUND`) |
| MessageRetentionWorker | audit_logs (`MESSAGE_DELETE`) |
| AttachmentRetentionWorker | audit_logs (`ATTACHMENT_DELETE`) |

UPDATE / DELETE 는 application 차원에서 불가능 (트리거 차단). 운영 배치만 superuser 권한으로 트리거 일시 비활성화 후 DELETE.

---

## 12. 위장 / 보안 강화 사항

1. **외부 endpoint 0개**: admin 화면 / 운영 API 자체가 없으므로 외부 노출 표면 0
2. **append-only 트리거**: 코드 버그 / SQL 인젝션 / 의도적 위변조 모두 DB 차원 차단
3. **context PII 누설 키 lint**: 코드 단계에서 차단. PR 머지 차단
4. **UNLOCK_FAIL 외부 응답은 위장**: 내부 audit 만 사실 기록 — 외부에서 시도 추적 불가
5. **trigger DISABLE 권한 = superuser**: application user 로는 row 수정/삭제 시도 자체 불가
6. **audit_logs 1년 + 30일 buffer**: 사고 추적 가능 시간 + 안전 마진
7. **target_id + target_external_id 양쪽 기록**: internal bigint 는 운영 SQL 용, external_id 는 외부 시스템 매핑용. 본문에 external_id 만 사용 권장

---

## 전제 / 우선순위 적용

- **외부 사용자 endpoint 0개**: PLAN-003 admin 미도입 (requirements_spec §4 + brief §3 + permission_policy §3)
- **append-only 강제**: 어떠한 사용자 / 시스템도 row 수정·삭제 불가. 운영 batch 만 예외
- **PII 누설 키 lint**: dev_conventions §8 금지 패턴 강화
- **시계열 분석은 SQL**: Grafana 등 외부 시각화는 v2 검토. v1 은 psql + jq
- **PUT 미사용**: 본 도메인 외부 endpoint 0개이므로 무관
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-API-AUDIT_LOG_
