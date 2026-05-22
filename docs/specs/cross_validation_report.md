# Cross-Validation Report — PLAN-003

작성: 2026-05-20T01:55:00Z
검증자: TT-Cross / Claude Opus 4.7

---

## 1. 요약

- 검토 문서: 21개
  - base/ 2: requirements_spec, baseline_manifest
  - spec/ 9: status_values_final, state_transition_table, permission_policy, development_conventions, db_design, ddl(.sql 미열람 — db_design 1:1 일치 가정), menu_structure, screen_inventory_and_function_definition, user_scenarios
  - api/ 10: auth, user_management, news, secret_unlock, pairing, message, chat, attachment, notification, audit_log
- 검출 이슈
  - 충돌: **0건**
  - 누락: **3건** (MISSING-001, MISSING-002, MISSING-003)
  - 미정의 용어: **0건**
- 결과: **FAIL** (누락 0건 기준 위반)
  - 다만 세 건 모두 단일 항목·단일 줄 수준 보완으로 해소 가능

---

## 2. 충돌 (서로 다른 문서가 모순됨)

**없음.**

내부 텍스트 검토 시 다음 케이스를 후보로 검토했으나 모두 *의도된 정책* 또는 *자체 명시된 한계* 임을 확인:

- (검토 케이스 A) `dev_conventions §4-4` 의 `/unlock/* = 위장 (실패 시 정상 200 + 가짜 기사)` 표현 vs `secret_unlock_api §1` 의 `/unlock/attempt` 만 위장 특수, `/unlock/ping`·`/unlock/revoke` 는 일반 위장 404 — **모순 아님**: dev_conventions §4-4 의 라우트군 모드 매트릭스는 *대표 정책* 으로 일반화된 서술이고, secret_unlock_api §1 에 unlock attempt 와 ping/revoke 의 위장 구현 차이를 별도 명시. 두 문서가 함께 읽혔을 때 외부 식별 불가 결과는 동일.
- (검토 케이스 B) `notification_api §4-2` 의 dry-run 흐름이 `db_design §4-10` notification_queue CHECK 제약 (`trigger_kind LIKE 'MESSAGE\_%' → trigger_message_id IS NOT NULL`) 위반 — **모순 아님**: notification_api §4-2 처리 흐름 6번 자체에서 CHECK 위반을 명시 인지하고 "notification_queue 미저장 + 직접 FCM 호출" 우회 명시. v1.1 에 `NOTIFICATION_DRY_RUN` trigger_kind / audit kind 추가 권장으로 보존.
- (검토 케이스 C) `db_design.md §3` 14개 테이블 vs `PROJECT.md` 메모리 `ddl_tables=11` — **검증 범위 외**: PROJECT 메모리는 PLAN-001/002 시점 스냅샷이며 PLAN-003 산출물 간 정합은 영향 없음.

---

## 3. 누락 (한쪽엔 있는데 다른 쪽엔 없음)

### MISSING-001 — chat_api `unlock:revoked` reason enum 에 `EXPIRED` 누락

- 영향 문서:
  - `output/api/chat_api_spec.md` §A (line ~86): `unlock:revoked` payload `{ reason: 'BACKGROUND' | 'LOGOUT' | 'APP_RESTART' | 'PAIR_DISCONNECT' | 'NEW_UNLOCK' }`
  - `output/spec/user_scenarios.md` SCN-007 Step 2: `unlock_sessions: ACTIVE → EXPIRED → WebSocket unlock:revoked 이벤트 (reason: "EXPIRED" equivalent)`
  - `output/spec/state_transition_table.md` §4 unlock_sessions 전이: `ACTIVE → EXPIRED (system, 30분 만료)` 정의
  - `output/api/chat_api_spec.md` §C 연결 종료 사유: `unlock_token 만료 (EXPIRED) → 즉시 종료` — 그러나 종료 직전 클라이언트에 푸시할 이벤트 reason 이 §A enum 에 부재
- 모순/누락 내용: state_transition + user_scenarios 가 명확히 `EXPIRED` 케이스를 ws 이벤트로 통지하도록 흐름을 정의하지만, chat_api §A 의 `unlock:revoked.reason` enum 에 `EXPIRED` 가 없어 SCN-007 의 "equivalent" 표현이 매핑 누락 신호.
- 수정 방향:
  - (옵션 A — 권장) chat_api §A `unlock:revoked` reason enum 에 `EXPIRED` 추가 (`revoked_reason` DB 컬럼 enum 과는 별개 — 클라이언트 통지용 ws-only reason).
  - (옵션 B) 별도 `unlock:expired` ws 이벤트 분리 + SCN-007 Step 2 표현을 해당 이벤트로 갱신.

### MISSING-002 — secret_unlock_api §4-4 reset-complete 처리에 unlock_sessions REVOKE 누락

- 영향 문서:
  - `output/api/secret_unlock_api_spec.md` §4-4 처리 흐름 6번: `UPDATE sequence_reset_tokens SET consumed_at=now()` + `UPDATE agent_secret_sequences SET status='REGISTERED', hash=?, salt=?, ...` + `INSERT INTO audit_logs (kind='SEQUENCE_RESET_COMPLETE', ...)` — unlock_sessions 의 활성 ACTIVE row REVOKED 처리 *누락*
  - `output/spec/user_scenarios.md` SCN-012 Step 4: `"unlock_sessions: 활성 ACTIVE 있으면 REVOKED (reset 완료 시 기존 unlock 무효화)"` 명시
  - `output/spec/state_transition_table.md` §4 unlock_sessions: `ACTIVE → REVOKED (앱 재시작 / 명시 로그아웃 / 시퀀스 reset 완료)` 명시
- 모순/누락 내용: state_transition + user_scenarios 양쪽 모두 reset-complete 시 unlock 무효화를 흐름으로 못 박았으나, secret_unlock_api §4-4 의 DB 매핑 표 (§8) 와 처리 흐름에 unlock_sessions 쓰기가 빠져 있어 구현이 누락될 위험.
- 수정 방향:
  - secret_unlock_api §4-4 처리 흐름에 추가: `UPDATE unlock_sessions SET status='REVOKED', revoked_reason='LOGOUT' WHERE agent_id=? AND status='ACTIVE'`
  - §8 DB 매핑 표에도 `unlock_sessions (REVOKED)` 추가
  - revoked_reason 값은 db_design §4-4 CHECK enum 중 의미 적합 항목 선정 (예: 신규 enum 추가 — `RESET_COMPLETE` — 권장. 현재 enum 에 정확히 매칭되는 값 없음)

### MISSING-003 — 모든 mutating API 의 G4 매핑에 `idempotency_keys` 테이블 미표기

- 영향 문서:
  - `output/spec/db_design.md` §4-14: idempotency_keys 테이블 정의 (Idempotency-Key 멱등성 캐시, 24시간 TTL)
  - `output/api/*_api_spec.md` 의 G4 매핑 표 (각 spec §6 또는 §7 / §8): 모든 mutating endpoint 가 `Idempotency-Key` 헤더 필수 명시하지만, R/W 대상 테이블 표에 `idempotency_keys` 미등장 (auth/secret_unlock/pairing/message/attachment/notification 모두)
- 모순/누락 내용: db_design 에 정의된 테이블이 ≥1 API 의 G4 표에 명시되지 않음 — 운영자 시점에서 어느 미들웨어가 어느 endpoint 에서 R/W 하는지 추적 어려움.
- 수정 방향:
  - (옵션 A) 각 mutating endpoint 의 G4 표에 `idempotency_keys (middleware R/W)` 1행 추가 — 미들웨어 처리이지만 명시.
  - (옵션 B) db_design §4-14 비고에 "모든 mutating endpoint 가 Idempotency middleware 를 경유하여 R/W. 개별 endpoint G4 표에는 미들웨어 처리로 생략" 명시 — 운영 가시성 절충.
  - 권장: 옵션 B (개별 G4 표 전수 갱신 비용 > 단일 메모 명시).

---

## 4. 미정의 용어

**없음.**

후보로 검토한 항목들은 모두 다른 문서에서 정의되거나 외부 기술 용어 (RN API 명, FCM error code, MIME 시그니처 등) 로 cross-validation 범위 외.

특기:

- `dev_conventions §7-17` 의 `enableScreenshotProtection` — RN 정식 API 가 아닌 라이브러리 의존 표현. 운영 권장사항이며 도메인 정합 검증 대상 외.
- `secret_unlock_api §4-7` 의 reason enum `{APP_RESTART, LOGOUT, MANUAL}` vs `db_design §4-4` CHECK `{BACKGROUND, LOGOUT, APP_RESTART, PAIR_DISCONNECT, NEW_UNLOCK}` — `MANUAL` 이 DB enum 에 없음. 그러나 secret_unlock_api §4-7 검증 규칙은 "사용자 명시 종료 입력값" 한정이며 실제 DB INSERT 시점에 `LOGOUT` 같은 유효 enum 으로 매핑된다는 해석 가능. 다만 명시적 매핑이 없어 잠재 정합 위험. → MISSING 으로 잡기엔 약함. 운영 권장 메모로 기록 (아래 §6 참조).

---

## 5. 4축 매트릭스 자가 검증 요약

### 매트릭스 1 — 상태 (21개)

| 상태 | status_values | state_transition | api endpoint | screen action |
|---|---|---|---|---|
| ACTIVE (agents) | §2 | §2 | auth signup | SCR-001~030 권한 필터 |
| DELETED (agents) | §2 | §2 | user_management §4-3 | SCR-031 ACT-092 |
| NOT_REGISTERED / REGISTERED / RESET_PENDING | §3 | §3 | secret_unlock §4-1~4-4 | SCR-010/030/032/033 |
| ACTIVE / EXPIRED / REVOKED (unlock) | §4 | §4 | secret_unlock §4-5/6/7 | SCR-011 ACT-041 / SCR-020 |
| PAIRING_REQUESTED / PAIRED / PAIRING_REJECTED / DISCONNECTED | §5 | §5 | pairing §4-1~4-6 | SCR-021/022/034 |
| SENT / DELETED (messages) | §6 | §6 | message §4-1 / worker | SCR-020 ACT-053 |
| PENDING / AVAILABLE / DELETED (attachments) | §7 | §7 | attachment §4-1 + message §4-1 | SCR-020 ACT-054/055/056 |
| QUEUED / SENT / FAILED (notification) | §8 | §8 | notification §5 worker (system) | - (system only) |

→ 모든 셀 매핑 완료. (단, MISSING-001: `EXPIRED` 의 ws 이벤트 reason 누락)

### 매트릭스 2 — 권한 (단일 사용자 유형)

PLAN-003 = `agent` 1종. permission_policy §3 정의. 모든 api endpoint 의 권한 명시가 §4-1-1 (CRUD) + §4-1-2 (업무 액션) 와 1:1 매핑.

screen_inventory 의 권한별 노출 차이도 `agent + REGISTERED / unlock_token 유효 / PAIRED` 같은 *상태 조합* 으로만 분기. 사용자 유형 분기 없음 — 정합.

→ 모든 셀 매핑 완료.

### 매트릭스 3 — 데이터 (14개 테이블)

| 테이블 | api endpoint R/W |
|---|---|
| agents | auth/user_management/secret_unlock/pairing 등 다수 |
| agent_secret_sequences | secret_unlock §4-1~4-4 |
| sequence_reset_tokens | secret_unlock §4-3/4-4 |
| unlock_sessions | secret_unlock §4-5/6/7 + auth §4-3 (logout) + pairing §4-6 (disconnect) + (**MISSING-002**: reset-complete) |
| refresh_tokens | auth §4-1~4-4 |
| push_tokens | auth §4-5/6 + notification §4-1 (R) + worker |
| pairings | pairing 전체 |
| messages | message + chat history |
| message_attachments | attachment + message §4-1 + chat history |
| notification_queue | message §4-1 INSERT / pairing §4-1/4-4 INSERT / worker UPDATE |
| fake_headlines | notification §4-2 / worker / message+pairing INSERT 시 |
| news_articles_cache | news 전체 |
| audit_logs | audit_log §3 → 모든 도메인 (INSERT only) |
| idempotency_keys | 모든 mutating endpoint 의 middleware (**MISSING-003**: G4 표에 미명시) |

→ 모든 테이블이 ≥1 api 에서 사용. 컬럼 단위 typo / 타입 불일치 별도 미발견 (ddl.sql 미열람 — db_design 1:1 일치 가정).

### 매트릭스 4 — 시나리오

user_scenarios.md §4 G6 게이트 자가 검증 표에서 29개 전이 행 전체 커버. screen_inventory + api endpoint 매핑도 시나리오 step 별 명시.

검출 보완 케이스 1건:

- SCN-007 Step 2 의 "EXPIRED equivalent" 표현 → MISSING-001 매핑.

→ 모든 시나리오 step 의 화면/액션/api 매핑 OK.

---

## 6. 운영 권장 메모 (FAIL 판정과 무관 — v1.1 보강 후보)

cross-validation 판정 기준 (충돌 / 누락 / 미정의) 에는 해당하지 않으나, 향후 보강 권장:

- (R-1) secret_unlock_api §4-7 의 reason enum `{APP_RESTART, LOGOUT, MANUAL}` 중 `MANUAL` 이 db_design §4-4 revoked_reason CHECK enum 에 없음 — API spec 의 입력 enum 과 DB enum 매핑 명시 권장.
- (R-2) audit_log_api §4 카탈로그 23종 외 `NOTIFICATION_DRY_RUN`, `SEQUENCE_RESET_EXPIRED`, `WS_UNAUTHORIZED_EVENT` 등 system 자동 이벤트 audit 미정의 — notification §10 / 본 보고서 §3 MISSING 후보군과 별개로 v1.1 운영 추적 강화 시 보강 권장.
- (R-3) chat_api §A `attachment:available` 와 message §4-1 의 `message:new` (첨부 메타 포함) 가 의미 중복 — `attachment:available` 의 트리거 시점이 message §4-1 트랜잭션 안 PENDING → AVAILABLE 전이 외 별도 시점이 거의 없으므로, 단일 `message:new` 로 통합 권장. 또는 `attachment:available` 의 별도 트리거 시점 명시.

---

## 7. PASS 판정 기준

- 충돌 0건 → **PASS**
- 누락 0건 (단, "이번 버전 범위 밖" 으로 명시된 항목은 제외) → **FAIL (3건)**
- 미정의 용어 0건 → **PASS**

---

## 8. 결과

- 충돌: **0건 → PASS**
- 누락: **3건 → FAIL** (MISSING-001, MISSING-002, MISSING-003)
- 미정의: **0건 → PASS**

**전체: FAIL**

핵심 흐름 (시퀀스 reset 완료 시 unlock 무효화, unlock 자연만료 ws 통지) 의 spec 누락 2건은 단일 줄 수준 보완으로 해소 가능. idempotency_keys G4 명시 1건은 단일 메모로 해소.

---

작성자: TT-Cross / Claude Opus 4.7
