# agentNews 권한 정책 v1.0

---

## 1. 문서 목적

본 문서는 agentNews v1 의 사용자 유형과 각 유형이 수행할 수 있는 액션을 정의한다.
state_transition_table.md 의 모든 "수행자" 표기는 본 문서의 사용자 유형과 1:1 매핑된다 (G3 게이트).

PLAN-003 의 단일 사용자 유형 = **에이전트 (agent)**. admin/anonymous 는 v1 범위 밖이며, 운영 작업은 직접 DB/서버 접근으로 처리한다 (requirements_spec.md §4).

---

## 2. 권한 체계

### 2-1. 기본 권한 (CRUD)

1. **조회** (READ)
2. **등록** (CREATE)
3. **수정** (UPDATE)
4. **삭제** (DELETE — soft delete 기본 / hard delete 예외 명시)

### 2-2. 업무 액션 권한

1. **회원가입 / 로그인 / 로그아웃** (인증 흐름)
2. **비밀 시퀀스 등록 / 변경 / reset 요청 / reset 완료**
3. **비밀 시퀀스 검증 (unlock)** — unlock_token 발급
4. **사용자 ID 검색** — external_id 기반
5. **페어링 요청 / 수락 / 거부 / 취소 / 해제**
6. **메시지 전송 / 수신 / 삭제**
7. **첨부파일 업로드 / 다운로드 (presigned URL)**
8. **위장 푸시 알림 수신** — FCM 수동성 (서버가 발송, 클라이언트는 수신만)

### 2-3. 판정 원칙

- 권한 = **사용자 유형** + **활성 페어 범위** 동시 확인
- "활성 페어 범위" = 본인이 `PAIRING_REQUESTED` 또는 `PAIRED` 상태로 연결된 단일 페어
- 페어 외부 자원 (다른 페어의 메시지/첨부/페어링 row) 은 모든 액션 불가
- 모든 권한 거부 응답은 위장 형식 (`404 NEWS_ARTICLE_NOT_FOUND` 등 — REQ-009, SEC-006)
- 인증 안 된 요청 (Authorization 헤더 미존재) 도 동일 위장 응답
- 업무 액션 권한은 CRUD 와 별도 — 메시지 수정은 CRUD 의 UPDATE 가 아니라 "수정 액션 불가" 로 분리 명시

---

## 3. 사용자 유형

본 시스템의 사용자 유형은 다음 1종이다.

1. **에이전트 (agent)** — 이메일+비밀번호로 가입한 회원

비-사용자 entity (state_transition 의 "수행자" 컬럼에 등장하지만 권한 주체가 아닌 것) :

- **system** — 스케줄러 / 트리거 / 자동 cascade. 권한 검사 대상 외 (DB 직접 실행, JWT 없음)
- **external** — FCM / MinIO / 이메일 발송 등 외부 시스템. 권한 검사 대상 외

본 문서 §4 이하는 `agent` 권한만 정의한다.

---

## 4. 사용자 유형별 권한

### 4-1. 에이전트 (agent)

#### 4-1-1. CRUD 권한 (엔티티별)

| 엔티티 | 조회 | 등록 | 수정 | 삭제 | 범위 제약 |
|---|---|---|---|---|---|
| agents (본인) | ✓ | ✓ (가입 시) | ✓ (프로필) | ✓ (탈퇴, soft) | 본인 row 만 |
| agents (타인) | △ | - | - | - | 검색 시 external_id + 공개 프로필만. 이메일 미포함 |
| agent_secret_sequences | ✓ (본인 hash 메타만) | ✓ | ✓ (현재 시퀀스 재인증 필요) | - | 본인 row 만 |
| unlock_sessions | ✓ (본인) | ✓ (시퀀스 검증 시) | - | ✓ (REVOKE, soft) | 본인 row 만 |
| pairings | ✓ | ✓ (요청 발송) | ✓ (수락/거부/취소/해제) | - | 자기가 참여한 페어 row 만 |
| messages | ✓ | ✓ (전송) | - | - | PAIRED 상태 + unlock_token 유효 시, 본인 페어의 메시지만 |
| message_attachments | ✓ (presigned URL) | ✓ (업로드) | - | - | 위 messages 와 동일 |
| notification_queue | - | - | - | - | 클라이언트 노출 안 함 (서버 내부 큐) |
| audit_logs | - | - | - | - | 운영 직접 DB 접근만 |
| news_articles (외부 API 캐시) | ✓ | - | - | - | 모두 |

범례: `✓` = 가능, `-` = 불가능, `△` = 제한적 가능 (옆 칸 조건 참조)

#### 4-1-2. 업무 액션 권한

| 액션 | 가능 여부 | 조건 / 제약 |
|---|---|---|
| 회원가입 (이메일+비밀번호) | ✓ | 이메일 시스템 내 유일, bcrypt cost 12 해싱 |
| 로그인 (access + refresh 발급) | ✓ | 자격증명 검증 통과 |
| 로그아웃 (refresh 무효화) | ✓ | 본인 토큰 |
| 시퀀스 등록 (최초) | ✓ | `NOT_REGISTERED` 상태 + 길이 4~6 |
| 시퀀스 변경 | ✓ | 현재 시퀀스 재입력 검증 통과 |
| 시퀀스 reset 요청 | ✓ | `REGISTERED` 상태에서만 |
| 시퀀스 reset 완료 (재등록) | ✓ | reset 링크 30분 내 클릭 |
| 시퀀스 검증 (unlock) | ✓ | `REGISTERED` 상태. 1초 내 동일 기사 재탭 무시 (rate limit) |
| 사용자 ID 검색 | ✓ | external_id 입력. 자기 자신/이미 활성 페어 중인 사용자 제외 |
| 페어링 요청 발송 | ✓ | 활성 페어 없을 때만 (REQ-014) |
| 페어링 수락 | ✓ | 본인이 수신자인 `PAIRING_REQUESTED` row 만. Idempotency-Key |
| 페어링 거부 | ✓ | 위와 동일 |
| 페어링 취소 (요청자) | ✓ | 본인이 발신한 `PAIRING_REQUESTED` row 만 |
| 페어링 해제 | ✓ | 본인이 참여한 `PAIRED` row 만. 양측 메시지/첨부 cascade hard delete |
| 메시지 전송 | ✓ | `PAIRED` + unlock_token 유효. AES-256-GCM 암호화 저장 |
| 메시지 수신 (WebSocket) | ✓ | `PAIRED` + unlock_token 유효. 서버 자동 join (client subscribe 거부) |
| 메시지 수정 | - | v1 미지원 (audit 보존 원칙) |
| 메시지 삭제 | - | 사용자 액션 미지원 (90일 자동 / 페어 해제 cascade 만) |
| 첨부 업로드 | ✓ | MIME allow-list 4종 + 매직바이트 검증. 이미지 ≤10MB / PDF ≤25MB |
| 첨부 다운로드 | ✓ | 본인 페어 + unlock_token 유효. presigned URL 30분 |
| 첨부 삭제 | - | 사용자 액션 미지원 (90일 자동 / 페어 해제 cascade 만) |
| 위장 푸시 수신 | ✓ | FCM 토큰 등록된 본인 기기 |
| 가짜 헤드라인 풀 조회 | - | 서버 전용 |
| audit_logs 조회 | - | 운영 직접 DB 접근만 |

#### 4-1-3. 접근 가능 화면 (screen_inventory 와 정합)

- 뉴스 피드 화면
- 기사 상세 화면 (시퀀스 입력 진입점)
- 채팅 화면 (unlock_token 유효 시만 노출)
- 페어링 검색·요청·수락/거부 화면 (채팅 모드 내부)
- 설정 화면 (프로필 / 시퀀스 변경 / reset 요청 / 로그아웃 / 페어 해제)
- 회원가입 / 로그인 화면

비밀 채팅 화면군은 unlock_token 유효 동안만 접근. 만료/REVOKED 즉시 뉴스 피드로 강제 복귀 (REQ-023, REQ-024).

---

## 5. 액션 매트릭스 (요약)

PLAN-003 은 단일 사용자 유형이므로 매트릭스는 1 컬럼이다. `system` / `external` 은 권한 주체가 아니지만 액션 출처를 보이기 위해 참고 컬럼으로 표기 (✓ 는 권한, ◎ 는 시스템 자동 처리).

| # | 액션 | agent | system | external | 권한 거부 응답 형식 |
|---|---|---|---|---|---|
| 1 | 회원가입 | ✓ | - | - | 400 / 위장 응답 없음 (앱 내부) |
| 2 | 로그인 | ✓ | - | - | 401 (앱 내부 화면) |
| 3 | 로그아웃 | ✓ | - | - | - |
| 4 | 시퀀스 등록 | ✓ | - | - | 401 / 위장 응답 없음 (앱 내부) |
| 5 | 시퀀스 변경 | ✓ | - | - | 위와 동일 |
| 6 | 시퀀스 reset 요청 | ✓ | - | ◎ (이메일 발송) | - |
| 7 | 시퀀스 reset 완료 | ✓ | - | - | - |
| 8 | 시퀀스 검증 (unlock) | ✓ | - | - | **위장**: 시퀀스 실패 시 정상 기사 상세 표시 |
| 9 | 사용자 ID 검색 | ✓ | - | - | 검색 결과 없음 / 자기/페어중 제외 |
| 10 | 페어링 요청 발송 | ✓ | - | - | 409 (활성 페어 존재) |
| 11 | 페어링 수락 | ✓ | - | - | 404 NEWS_ARTICLE_NOT_FOUND (위장) |
| 12 | 페어링 거부 | ✓ | - | - | 위와 동일 |
| 13 | 페어링 취소 | ✓ | - | - | 위와 동일 |
| 14 | 페어링 해제 | ✓ | - | - | 위와 동일 |
| 15 | 메시지 전송 | ✓ | - | - | 위와 동일 |
| 16 | 메시지 수신 (WS) | ✓ | - | - | WS handshake 거부 (404) |
| 17 | 메시지 90일 삭제 | - | ◎ | - | - |
| 18 | 메시지 cascade 삭제 | - | ◎ | - | - |
| 19 | 첨부 업로드 | ✓ | - | ◎ (MinIO) | 위장 404 |
| 20 | 첨부 다운로드 | ✓ | - | ◎ (MinIO presigned) | 위장 404 |
| 21 | 첨부 90일 삭제 | - | ◎ | ◎ (MinIO hard delete) | - |
| 22 | 첨부 cascade 삭제 | - | ◎ | ◎ (MinIO hard delete) | - |
| 23 | 위장 푸시 수신 | ✓ (수동) | - | ◎ (FCM) | - |
| 24 | 위장 푸시 발송 | - | ◎ | ◎ (FCM) | - |
| 25 | unlock 자연만료 | - | ◎ | - | API 호출 시 401 → 뉴스 피드 강제 이동 |
| 26 | unlock 백그라운드 종료 | ✓ (간접 트리거) | ◎ | - | - |
| 27 | 뉴스 피드 조회 | ✓ | - | ◎ (뉴스 API) | - |
| 28 | audit_logs 기록 | - | ◎ | - | append-only 트리거 |

범례: `✓` = 사용자 권한, `◎` = 시스템/외부 자동, `-` = 해당 없음

---

## 6. 보안 규칙

다음 규칙은 권한 검사와 무관하게 *항상* 강제된다 (가드 미들웨어 / DB 제약 / 트리거).

1. **위장 응답 원칙**: 인증 안 됨 / 권한 없음 / 페어 외부 자원 접근 / unlock 만료 / `PAIRED` 아님 — 모두 `404 NEWS_ARTICLE_NOT_FOUND` 형식으로 응답. 외부에서 일반 뉴스 API 응답과 구분 불가 (REQ-009, SEC-006)
2. **이메일 노출 금지**: 사용자 검색·페어링 응답·프로필 등 모든 외부 API 응답에 다른 사용자의 이메일 포함 금지. 검색 키는 `external_id` (uuid) 만 (REQ-010)
3. **IDOR 차단**: pairings / messages / message_attachments / notification_queue 의 외부 API 응답은 internal bigserial id 노출 금지. `external_id` (uuid) 만 사용 (SEC-004)
4. **WebSocket 자동 join**: handshake 시 서버가 자동으로 `pairing:<pairing_id>` 채널에 join. 클라이언트의 subscribe/join 이벤트 거부 (SEC-005, REQ-015)
5. **본인 이외 row 수정 금지**: 모든 UPDATE 쿼리는 `WHERE id = ? AND agent_id = req.user.id` (또는 페어 양측 검증). DB 레벨 row-level security 또는 서비스 레이어 강제
6. **API 멱등성 강제**: POST/PUT/DELETE 모든 mutating 요청에 `Idempotency-Key` 헤더 필수. 중복 처리 방지 (SEC-008)
7. **시퀀스 평문 저장 금지**: HMAC-SHA256 + 16B salt 만 저장. 응답에 평문 시퀀스 1회 (등록 직후 확인용) 노출 후 즉시 폐기 (SEC-009)
8. **메시지 본문 평문 저장 금지**: AES-256-GCM 서버측 단일키. DB 컬럼은 ciphertext + iv + tag 분리 저장 (SEC-002)
9. **audit_logs append-only**: DB 트리거로 UPDATE/DELETE 차단. 모든 보안·운영 이벤트 1년 보존 (SEC-010, REQ-025)
10. **첨부 매직바이트 검증**: 클라이언트 declared MIME 이 아닌 실제 파일 헤더 검증. 불일치 시 업로드 거부 (SEC-007, REQ-018)
11. **권한 거부 정보 누설 금지**: 위장 응답은 "사유" / "에러 코드" / "재시도 안내" 등 어떠한 권한 거부 단서도 포함 금지
12. **JWT 저장 위치 강제**: 모바일 토큰은 react-native-keychain 만. httpOnly cookie 사용 금지 (SEC-003)
13. **활성 페어 슬롯 DB 제약**: 1 agent 당 동시 `PAIRING_REQUESTED` ∨ `PAIRED` 페어 1개 — DB partial unique index 로 race condition 차단 (REQ-014)
14. **unlock_token 단일성**: 1 agent 당 동시 `ACTIVE` unlock 세션 1개. 신규 검증 시 기존 ACTIVE 를 REVOKED 처리 후 신규 발급

---

## 7. state_transition_table 수행자 매핑 검증 (G3)

state_transition_table.md 의 모든 "수행자" 표기가 본 문서의 사용자 유형과 일치하는지 확인.

| state_transition 의 수행자 표기 | 본 문서 대응 | 권한 정의 위치 |
|---|---|---|
| `agent` | 에이전트 (본인 row) | §4-1 |
| `agent (counterpart)` | 에이전트 (페어 상대 row) — 동일 사용자 유형, 다른 row | §4-1 (페어 수락/거부 등) |
| `agent (requester)` | 에이전트 (요청자 row) — 동일 사용자 유형 | §4-1 (페어링 요청/취소) |
| `system` | 비-사용자 — 스케줄러/트리거/cascade | §3 (권한 검사 대상 외) |
| `external (FCM)` | 비-사용자 — 외부 시스템 | §3 (권한 검사 대상 외) |

모든 수행자 표기 매핑 완료. **G3 게이트 충족**.

---

## 전제 / 우선순위 적용

- **단일 사용자 유형**: PLAN-003 brief §3 + intake §1 + requirements_spec.md §4 가 명시 — admin/anonymous 미정의. PLAN-001/002 DECISIONS 의 3종 모델은 PLAN-003 brief 가 명시 변경
- **운영 작업은 DB 직접 접근**: admin 화면/계정 v1 미도입. 페어링 강제 해제 등은 v1 범위 밖
- **위장 우선**: 모든 권한 거부 응답은 권한 시스템 출력이 아니라 위장 응답 (404 NEWS_ARTICLE_NOT_FOUND) 으로 가공된 후 외부로 나감
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-Arch (Claude Opus 4.7) — PLAN-003-DOC-PERMISSION-POLICY_
