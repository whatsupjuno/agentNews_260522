# agentNews 사용자 시나리오 v1.0

---

## 1. 문서 목적

agentNews v1 의 에이전트 end-to-end 사용 시나리오를 정의한다.
state_transition_table.md 의 모든 전이 행이 ≥1 시나리오 step 에 등장해야 한다 (G6 게이트).
PLAN-003 은 단일 사용자 유형 (에이전트) 이므로 모든 시나리오는 에이전트 관점.

---

## 2. 시나리오 목록

| 시나리오 ID | 유형 | 시나리오명 | 경로 유형 | 시작 화면 | 종료 상태 |
|---|---|---|---|---|---|
| SCN-001 | agent | 회원가입 + 시퀀스 등록 | happy | SCR-001 | sequence_status=REGISTERED |
| SCN-002 | agent | 위장 진입 → 1:1 채팅 전송 | happy | SCR-010 | message.status=SENT, notification_queue.status=SENT |
| SCN-003 | agent | 페어링 요청 → 상대 수락 | happy | SCR-020 | pairings.status=PAIRED |
| SCN-004 | agent | 페어링 요청 → 상대 거부 | error | SCR-021 | pairings.status=PAIRING_REJECTED |
| SCN-005 | agent | 페어링 요청 → 본인 취소 | edge | SCR-022 | pairings.status=DISCONNECTED |
| SCN-006 | agent | 첨부파일(이미지) 전송 | happy | SCR-020 | attachment.status=AVAILABLE, message.status=SENT |
| SCN-007 | agent | unlock 토큰 30분 만료 → 뉴스 피드 강제 복귀 | error | SCR-020 | unlock_sessions.status=EXPIRED |
| SCN-008 | agent | 백그라운드 5초 초과 → 위장 복귀 | edge | SCR-020 | unlock_sessions.status=REVOKED (BACKGROUND) |
| SCN-009 | agent | 앱 재시작 → 위장 화면 유지 | edge | SCR-010 | unlock_sessions.status=REVOKED (APP_RESTART) |
| SCN-010 | agent | 페어 해제 + 메시지·첨부 cascade 삭제 | edge | SCR-034 | pairings.status=DISCONNECTED, messages=DELETED, attachments=DELETED |
| SCN-011 | agent | 비밀 시퀀스 변경 | edge | SCR-032 | sequence_status=REGISTERED (해시 갱신) |
| SCN-012 | agent | 시퀀스 분실 → 이메일 reset 복구 | error | SCR-033 | sequence_status=REGISTERED (신규 해시) |
| SCN-013 | agent | reset 링크 30분 만료 → 자동 원복 | edge | (외부 이메일) | sequence_status=REGISTERED (기존 해시 유지) |
| SCN-014 | agent | 첨부 업로드 후 미연결 → 30분 고아 정리 | error | SCR-020 | attachment.status=DELETED (system) |
| SCN-015 | agent | 메시지·첨부 90일 자동 삭제 | edge | (system) | messages.status=DELETED, attachments.status=DELETED |
| SCN-016 | agent | FCM 발송 실패 | error | (system) | notification_queue.status=FAILED |
| SCN-017 | agent | 로그아웃 → unlock 세션 종료 | edge | SCR-030 | unlock_sessions.status=REVOKED (LOGOUT) |
| SCN-018 | agent | 계정 탈퇴 | edge | SCR-031 | agents.status=DELETED |

---

## 3. 시나리오 상세

---

### SCN-001 — agent: 회원가입 + 시퀀스 등록 (happy path)

**트리거**: 새 에이전트가 앱을 처음 설치·실행

**Step 1.** 앱 시작 → 로그인 화면 (SCR-001)
- 화면: LoginScreen. "회원가입" 탭
- 액션: ACT-002 (route 이동)
- 다음: SCR-002 push

**Step 2.** 회원가입 화면에서 이메일·비밀번호·닉네임 입력 (SCR-002)
- 액션: ACT-010
- API: `POST /api/v1/auth/signup`
- 상태 전이: `agents: (없음) → ACTIVE`, `agent_secret_sequences: (신규) → NOT_REGISTERED`
- 부수효과: access + refresh 토큰 발급, audit `USER_SIGNUP`
- 다음: MainStack → SCR-010 이동 (가입 직후 로그인 상태)

**Step 3.** FCM 토큰 자동 등록 (백그라운드, SCR-010 진입 시)
- 액션: ACT-011 (자동)
- API: `POST /api/v1/auth/push-token`
- 결과: push_tokens row 생성

**Step 4.** 상단 배너 "비밀 시퀀스를 등록해주세요" → 설정 탭 이동 → SCR-032
- 액션: ACT-083 (탭 이동)
- 화면: SequenceChangeScreen (NOT_REGISTERED 모드)

**Step 5.** 새 시퀀스 [5,3,1,7] 입력 → "등록" 버튼 탭 (SCR-032)
- 액션: ACT-102
- API: `POST /api/v1/sequence`
- 상태 전이: `agent_secret_sequences: NOT_REGISTERED → REGISTERED`
- 부수효과: HMAC-SHA256 + salt 저장, audit `SEQUENCE_REGISTER`

**End state**: `agents.status=ACTIVE`, `sequence_status=REGISTERED`

---

### SCN-002 — agent: 위장 진입 → 1:1 채팅 전송 (happy path, 핵심 시나리오)

**전제**: REGISTERED + PAIRED 상태, 상대방 에이전트 B 도 PAIRED

**트리거**: 에이전트 A 가 뉴스 피드에서 비밀 채팅 진입을 시도

**Step 1.** 뉴스 피드 열람 (SCR-010)
- 액션: ACT-030 (자동)
- API: `GET /api/v1/news/feed`
- 결과: batchId + 기사 목록 (displayOrder 1~N) 표시

**Step 2.** 기사 5번째 → 3번째 → 1번째 → 7번째 순서로 탭 (SCR-010 → SCR-011 반복)
- 각 탭: ACT-032 → ACT-040 (SCR-011 push + 기사 상세 로드)
- API: `GET /api/v1/news/articles/:articleId`
- 시퀀스 입력 추적은 RN 로컬. 서버는 아직 호출 없음

**Step 3.** 4번째(마지막) 탭 후 백그라운드로 시퀀스 검증 발송 (SCR-011 유지)
- 액션: ACT-041 (자동)
- API: `POST /api/v1/unlock/attempt` body: `{ batchId, attempt: [5,3,1,7] }`
- 상태 전이: `unlock_sessions: (없음) → ACTIVE`
- 응답: `{ unlocked: true, unlockToken, expiresAt }` (HTTP 200)
- 부수효과: audit `UNLOCK_SUCCESS`
- 결과: ChatModal conditional swap → SCR-020 진입

**Step 4.** ChatScreen 진입 (SCR-020)
- 액션: ACT-050 (자동), ACT-051 (자동), ACT-052 (자동)
- API: `wss://<host>/ws` (handshake), `GET /api/v1/chat/history`, `GET /api/v1/pairings/current`
- 결과: 히스토리 + 상대방 닉네임 표시

**Step 5.** A 가 메시지 "작전 개시" 전송 (SCR-020)
- 액션: ACT-053
- API: `POST /api/v1/messages` body: `{ body: "작전 개시" }`
- 상태 전이: `messages: (없음) → SENT`
- 부수효과: AES-256-GCM 암호화 저장, WebSocket `message:new` B에게 broadcast
- 위장 알림 큐잉: `notification_queue: (없음) → QUEUED`
- audit `MESSAGE_SEND`

**Step 6.** jitter (0~60초) 후 FCM 위장 푸시 발송 (system)
- 상태 전이: `notification_queue: QUEUED → SENT`
- 발송 내용: `📰 새 뉴스 — {랜덤 헤드라인}` (data payload 없음)

**End state**: `messages.status=SENT`, `notification_queue.status=SENT`

---

### SCN-003 — agent: 페어링 요청 → 상대 수락 (happy path)

**전제**: A, B 모두 REGISTERED + unlock_token 유효 + 활성 페어 없음

**트리거**: A 가 B 의 external_id 를 알고 페어링 요청

**Step 1.** A: ChatScreen 내 "페어 찾기" → SCR-021
- 액션: ACT-059 (route push)

**Step 2.** A: external_id 입력 후 "검색" (SCR-021)
- 액션: ACT-060
- API: `GET /api/v1/users/lookup/:externalId`
- 결과: B 닉네임 표시

**Step 3.** A: "요청 보내기" 탭 (SCR-021)
- 액션: ACT-061
- API: `POST /api/v1/pairings` body: `{ targetExternalId: B.externalId }`
- 상태 전이: `pairings: (없음) → PAIRING_REQUESTED`
- 부수효과: notification_queue INSERT (B에게 위장 푸시), audit `PAIRING_REQUEST`
- 결과: SCR-022 push (requester 뷰 — 대기 중)

**Step 4.** B: 위장 푸시 "📰 새 뉴스" 수신 → 탭 → 뉴스 피드 열림 → 시퀀스 입력 → unlock
- (SCN-002 Step 1~3 동일 흐름. unlock_sessions ACTIVE)

**Step 5.** B: ChatScreen → SCR-022 (recipient 뷰)
- 액션: ACT-070 (자동)
- API: `GET /api/v1/pairings/current` → role='recipient'

**Step 6.** B: "수락" 탭 (SCR-022)
- 액션: ACT-071
- API: `POST /api/v1/pairings/:externalId/accept`
- 상태 전이: `pairings: PAIRING_REQUESTED → PAIRED`
- 부수효과: WebSocket `pairing:paired` 양측 push, audit `PAIRING_ACCEPT`
- 결과: 양측 채팅 채널 즉시 활성

**End state**: `pairings.status=PAIRED`

---

### SCN-004 — agent: 페어링 요청 → 상대 거부 (error path)

**전제**: SCN-003 Step 3 완료 상태 (A: PAIRING_REQUESTED 대기, B: 요청 수신)

**Step 1~4**: SCN-003 Step 1~5 와 동일 (B 가 SCR-022 진입)

**Step 5'.** B: "거부" 탭 (SCR-022)
- 액션: ACT-072
- API: `POST /api/v1/pairings/:externalId/reject`
- 상태 전이: `pairings: PAIRING_REQUESTED → PAIRING_REJECTED`
- 부수효과: A 에게 위장 푸시 (PAIRING_REJECT), audit `PAIRING_REJECT`
- 결과: B → SCR-021 복귀 ("페어링이 거부됐습니다." — 앱 내부 알림)

**Step 6'.** A: 위장 푸시 수신 → unlock 후 SCR-022 조회
- API: `GET /api/v1/pairings/current` → data.pairing=null (거부됨 — active 페어 없음)
- 결과: A 는 다시 SCR-021 에서 새 대상 검색 가능

**End state**: `pairings.status=PAIRING_REJECTED`

---

### SCN-005 — agent: 페어링 요청 → 본인 취소 (edge path)

**전제**: SCN-003 Step 3 완료 (A: PAIRING_REQUESTED 대기)

**Step 1.** A: SCR-022 (requester 뷰) 확인
- 액션: ACT-070 (자동)
- API: `GET /api/v1/pairings/current`

**Step 2.** A: "취소" 탭 (SCR-022)
- 액션: ACT-073
- API: `POST /api/v1/pairings/:externalId/cancel`
- 상태 전이: `pairings: PAIRING_REQUESTED → DISCONNECTED`
- 부수효과: 활성 페어 슬롯 즉시 해제, audit `PAIRING_CANCEL`
- 결과: A → SCR-021 복귀 (다시 검색 가능)

**End state**: `pairings.status=DISCONNECTED` (요청자 취소)

---

### SCN-006 — agent: 첨부파일(이미지) 전송 (happy path)

**전제**: PAIRED + unlock_token 유효, 채팅 화면 활성

**Step 1.** A: 이미지 피커 열기 → 사진 선택 (SCR-020)
- 액션: ACT-054 (이미지 피커 트리거)

**Step 2.** 이미지 업로드 (SCR-020)
- API: `POST /api/v1/attachments` (multipart, image/jpeg, ≤10MB)
- 처리: 매직바이트 검증(FF D8 FF) + MinIO PUT
- 상태 전이: `message_attachments: (없음) → PENDING`
- 응답: `{ externalId, status: 'PENDING', expiresAt }`, audit `ATTACHMENT_UPLOAD_START`

**Step 3.** A: "전송" 버튼 탭 (caption 없이 또는 "작전 사진 확인" 입력)
- API: `POST /api/v1/messages` body: `{ body: "작전 사진 확인", attachmentExternalId: "<externalId>" }`
- 상태 전이 동시: `message_attachments: PENDING → AVAILABLE`, `messages: (없음) → SENT`
- 부수효과: audit `ATTACHMENT_AVAILABLE`, `MESSAGE_SEND`, notification_queue QUEUED, WebSocket `message:new` + `attachment:available` B에게 push

**Step 4.** B: 이미지 썸네일 탭 → presigned URL 발급 (SCR-020)
- 액션: ACT-056
- API: `GET /api/v1/attachments/:externalId/download-url`
- 응답: 30분 유효 presigned URL
- 결과: OS 이미지 뷰어에서 열기

**End state**: `message_attachments.status=AVAILABLE`, `messages.status=SENT`

---

### SCN-007 — agent: unlock 30분 만료 → 뉴스 피드 강제 복귀 (error path)

**전제**: PAIRED + unlock_token 발급 후 25분 경과 (5분 남음)

**Step 1.** ChatScreen 활성 중 unlock ping 정상 수신 (SCR-020)
- 액션: ACT-057 (5초 주기 자동)
- API: `POST /api/v1/unlock/ping`

**Step 2.** 30분 경과 → server worker 가 EXPIRED 처리 (system 자동)
- 상태 전이: `unlock_sessions: ACTIVE → EXPIRED`
- server → client: WebSocket `unlock:revoked` 이벤트 (`reason: "EXPIRED"` equivalent)

**Step 3.** RN: `unlock:revoked` 수신 → ChatModal 자동 닫힘 (SCR-020 종료)
- 결과: NewsFeedScreen 표시 (위장 유지 — 채팅 흔적 없음, REQ-023)
- 다음 채팅 진입은 시퀀스 재입력 필요

**End state**: `unlock_sessions.status=EXPIRED`, 화면=SCR-010

---

### SCN-008 — agent: 백그라운드 5초 초과 → unlock REVOKED + 위장 복귀 (edge path)

**전제**: PAIRED + unlock_token 유효, 채팅 화면 중

**Step 1.** A: 홈버튼으로 앱 백그라운드 진입 (SCR-020 → background)
- RN: AppState 'background' 감지 → unlock ping 중단

**Step 2.** 5초 경과 → server worker 감지 (system 자동)
- `unlock_sessions WHERE status='ACTIVE' AND last_seen_at < now()-5s`
- 상태 전이: `unlock_sessions: ACTIVE → REVOKED` (revoked_reason='BACKGROUND')
- audit `UNLOCK_BACKGROUND`

**Step 3.** A: 5초 후 앱 foreground 복귀
- RN: 다음 ping 시 `unlock/ping` → `NEWS_ARTICLE_NOT_FOUND` 404 수신
- 결과: ChatModal 자동 닫힘 → SCR-010 표시 (위장 유지, REQ-023)

**End state**: `unlock_sessions.status=REVOKED` (BACKGROUND), 화면=SCR-010

---

### SCN-009 — agent: 앱 재시작 → 위장 화면 + unlock 자동 종료 (edge path)

**전제**: 이전 세션에서 채팅 중 앱 강제 종료

**Step 1.** A: 앱 재시작 (콜드 스타트)
- RN: keychain 에서 access/refresh 토큰 로드 → 자동 로그인
- 화면: NewsFeedScreen 무조건 표시 (REQ-024)
- unlock_token: 앱 재시작 시 RN 로컬에서 파기 (keychain 에서 제거)

**Step 2.** RN: unlock/revoke 자동 호출 (백그라운드, 이전 unlock 정리)
- API: `POST /api/v1/unlock/revoke` body: `{ reason: "APP_RESTART" }` (이전 unlock_token 으로 호출)
- 상태 전이: `unlock_sessions: ACTIVE → REVOKED` (revoked_reason='APP_RESTART')
- audit `UNLOCK_REVOKE`
- 결과: 이전 채팅 화면 어디에도 표시 안 됨 (위장 완벽 유지)

**Step 3.** A: 뉴스 피드 정상 표시 (SCR-010)
- API: `GET /api/v1/news/feed` (자동)
- 결과: 일반 뉴스앱처럼 보임

**End state**: `unlock_sessions.status=REVOKED` (APP_RESTART), 화면=SCR-010

---

### SCN-010 — agent: 페어 해제 + 메시지·첨부 cascade 삭제 (edge path)

**전제**: PAIRED + 채팅 히스토리 142건 + 첨부 18건 존재

**Step 1.** A: 설정 → "페어 해제" (SCR-030 → SCR-034)
- 액션: ACT-085 (route push)

**Step 2.** SCR-034 진입 — 상대방 닉네임 + 경고 표시
- 액션: ACT-120 (자동)
- API: `GET /api/v1/pairings/current`
- 화면: "{B.nickname}님과의 모든 대화가 즉시 삭제됩니다." 경고

**Step 3.** A: "해제 확인" 탭 (SCR-034)
- 액션: ACT-121
- API: `POST /api/v1/pairings/:externalId/disconnect`
- 상태 전이 (동일 트랜잭션):
  - `pairings: PAIRED → DISCONNECTED`
  - `messages: SENT → DELETED` (cascade, 142건)
  - `message_attachments: AVAILABLE → DELETED` (cascade, 18건, storage_keys 수집)
  - `unlock_sessions: ACTIVE → REVOKED` (양측, revoked_reason='PAIR_DISCONNECT')
- commit 후 worker: MinIO deleteObjects (18건 hard delete)
- 부수효과: WebSocket `pairing:disconnected` 양측 push, audit `PAIRING_DISCONNECT`

**Step 4.** 양측: ChatModal 자동 닫힘 → SCR-010 복귀
- 결과: 메시지 / 첨부 데이터 0건 (물리 삭제 완료)

**End state**: `pairings.status=DISCONNECTED`, `messages.status=DELETED`, `message_attachments.status=DELETED`, `unlock_sessions.status=REVOKED`

---

### SCN-011 — agent: 비밀 시퀀스 변경 (edge path)

**전제**: sequence_status=REGISTERED

**Step 1.** A: 설정 → "시퀀스 변경" (SCR-030 → SCR-032)
- 액션: ACT-083

**Step 2.** 현재 시퀀스 [5,3,1,7] 입력 + 새 시퀀스 [4,2,8,1,6] 입력 후 "변경" (SCR-032)
- 액션: ACT-101
- API: `PATCH /api/v1/sequence` body: `{ currentSequence: [5,3,1,7], newSequence: [4,2,8,1,6] }`
- 서버: 현재 HMAC 검증 → 신규 salt+hash 생성
- 상태 전이: `agent_secret_sequences: REGISTERED → REGISTERED` (self-loop, 해시 갱신)
- 부수효과: audit `SEQUENCE_CHANGE`

**Step 3.** 결과: SCR-030 pop + "시퀀스가 변경됐습니다." 안내
- 다음 unlock 은 새 시퀀스 [4,2,8,1,6] 사용

**End state**: `sequence_status=REGISTERED` (새 해시)

---

### SCN-012 — agent: 시퀀스 분실 → 이메일 reset 복구 (error path)

**전제**: sequence_status=REGISTERED, 시퀀스 기억 못 함

**Step 1.** A: 설정 → "시퀀스 분실" (SCR-030 → SCR-033)
- 화면: 본인 이메일 표시 ("agent@example.com 으로 reset 링크 발송")
- 액션: ACT-110 (자동)
- API: `GET /api/v1/users/me`

**Step 2.** "이메일로 reset 링크 발송" 탭 (SCR-033)
- 액션: ACT-111
- API: `POST /api/v1/sequence/reset-request`
- 상태 전이: `agent_secret_sequences: REGISTERED → RESET_PENDING`
- 부수효과: sequence_reset_tokens INSERT (30분 유효), 이메일 발송, audit `SEQUENCE_RESET_REQUEST`

**Step 3.** A: 이메일 수신 → reset 링크 탭 → 앱 딥링크 → SCR-003
- 화면: SequenceResetScreen, 새 시퀀스 입력 UI

**Step 4.** 새 시퀀스 [7,1,3,5] 입력 → "등록 완료" (SCR-003)
- 액션: ACT-020
- API: `POST /api/v1/sequence/reset-complete` body: `{ resetToken, newSequence: [7,1,3,5] }`
- 상태 전이: `agent_secret_sequences: RESET_PENDING → REGISTERED` (신규 해시)
- 부수효과: reset_tokens consumed_at 갱신, audit `SEQUENCE_RESET_COMPLETE`
- unlock_sessions: 활성 ACTIVE 있으면 REVOKED (reset 완료 시 기존 unlock 무효화)

**Step 5.** 결과: LoginScreen 이동 → 재로그인 안내

**End state**: `sequence_status=REGISTERED` (신규 해시)

---

### SCN-013 — agent: reset 링크 30분 만료 → 시스템 자동 원복 (edge path)

**전제**: SCN-012 Step 2 완료 (RESET_PENDING 상태)

**Step 1.** A: 이메일 링크를 30분 이내 클릭하지 않음

**Step 2.** 서버 배치 (5분 주기) 자동 실행
- `sequence_reset_tokens WHERE expires_at < now() AND consumed_at IS NULL`
- 조건 만족 → token 무효화
- 상태 전이: `agent_secret_sequences: RESET_PENDING → REGISTERED` (기존 해시 유지, system 자동)
- 결과: A 는 기존 시퀀스로 여전히 unlock 가능

**Step 3.** A: 앱에서 설정 새로고침 → sequenceStatus=REGISTERED 확인
- API: `GET /api/v1/users/me`

**End state**: `sequence_status=REGISTERED` (기존 해시 원복), reset 링크 무효화

---

### SCN-014 — agent: 첨부 업로드 후 메시지 미전송 → 30분 고아 정리 (error path)

**전제**: PAIRED + unlock_token 유효

**Step 1.** A: 이미지 업로드 성공 (SCR-020)
- API: `POST /api/v1/attachments`
- 상태 전이: `message_attachments: (없음) → PENDING`

**Step 2.** A: 전송 화면 닫음 / 다른 작업으로 이동 → 30분 이내 메시지 미전송

**Step 3.** 30분 후 서버 배치 자동 실행
- `message_attachments WHERE status='PENDING' AND created_at < now()-30m`
- 상태 전이: `message_attachments: PENDING → DELETED` (system 자동)
- worker: MinIO 임시 객체 hard delete
- 결과: 해당 externalId 로 `GET /api/v1/attachments/:externalId` 시도 시 위장 404

**End state**: `message_attachments.status=DELETED` (고아 정리)

---

### SCN-015 — agent: 메시지·첨부 90일 자동 삭제 (edge / system path)

**전제**: PAIRED 페어에 90일 초과 메시지 및 첨부 존재

**Step 1.** 일배치 (자정) 자동 실행
- `SELECT id FROM messages WHERE deleted_at IS NULL AND sent_at < now()-90d`
- 상태 전이: `messages: SENT → DELETED` (system 자동, soft delete)
- audit `MESSAGE_DELETE`

**Step 2.** 연관 첨부파일 cascade 처리
- `SELECT id, storage_key FROM message_attachments WHERE message_id IN (...) AND deleted_at IS NULL`
- 상태 전이: `message_attachments: AVAILABLE → DELETED` (메시지 DELETED cascade, system)
- worker: MinIO deleteObjects (hard delete)

**Step 3.** 별도 90일 첨부 배치: 메시지 연결 없는 AVAILABLE 첨부도 별도 90일 체크
- `message_attachments WHERE status='AVAILABLE' AND created_at < now()-90d`
- 상태 전이: `message_attachments: AVAILABLE → DELETED` (90일 경과, system)

**Step 4.** A, B: 다음 히스토리 조회 시 삭제된 메시지 표시 안 됨
- API: `GET /api/v1/chat/history` → deleted_at IS NULL 조건으로 필터

**End state**: `messages.status=DELETED`, `message_attachments.status=DELETED` (90일 자동)

---

### SCN-016 — agent: FCM 발송 실패 (error path)

**전제**: notification_queue 에 QUEUED row 존재, B의 FCM 토큰 만료됨

**Step 1.** NotificationDispatchWorker 폴링 (1초 주기)
- `SELECT ... FROM notification_queue WHERE status='QUEUED' AND scheduled_at <= now() LIMIT 5 FOR UPDATE SKIP LOCKED`

**Step 2.** FCM API 호출 → 오류 `messaging/registration-token-not-registered`
- 상태 전이: `notification_queue: QUEUED → FAILED` (system)
- 부수효과: B의 push_tokens soft delete (무효 토큰 정리), audit `NOTIFICATION_FAIL`

**Step 3.** B: FCM 알림 미수신. 단, WebSocket 은 별도 채널 → 연결 유지 시 `message:new` 수신 가능
- 결과: B 가 앱 열면 히스토리 조회로 누락 메시지 동기화

**End state**: `notification_queue.status=FAILED`, push_tokens 해당 토큰 soft deleted

---

### SCN-017 — agent: 로그아웃 → unlock 세션 종료 + 위장 유지 (edge path)

**전제**: PAIRED + unlock_token 유효 + 채팅 화면 활성

**Step 1.** A: 채팅 종료 → 탭바 탭2 → 설정 (SCR-030)
- 결과: ChatModal 닫힘 → SCR-010 → SCR-030 이동

**Step 2.** "로그아웃" 탭 (SCR-030)
- 액션: ACT-087
- API: `POST /api/v1/auth/logout` (X-Refresh-Token 헤더 포함)
- 서버 처리: refresh_tokens revoke + push_tokens soft delete
- 상태 전이: `unlock_sessions: ACTIVE → REVOKED` (revoked_reason='LOGOUT')
- audit `UNLOCK_REVOKE`

**Step 3.** RN: keychain 에서 access/refresh 토큰 삭제
- 결과: AuthStack(LoginScreen) 이동
- 화면: SCR-001 (뉴스 피드가 보이지 않음 — 위장 노출 없음)

**End state**: `unlock_sessions.status=REVOKED` (LOGOUT), 화면=SCR-001

---

### SCN-018 — agent: 계정 탈퇴 (edge path)

**전제**: 활성 페어 없음 (PAIRED 시 탈퇴 불가 — SCN-010 먼저 수행 필요)

**Step 1.** A: 설정 → 프로필 편집 (SCR-030 → SCR-031)
- 액션: ACT-082

**Step 2.** "탈퇴" 버튼 탭 → 비밀번호 확인 모달 (SCR-031)
- 비밀번호 입력 → "확인" 탭

**Step 3.** 탈퇴 처리 (SCR-031)
- 액션: ACT-092
- API: `DELETE /api/v1/users/me` body: `{ passwordConfirmation: "..." }`
- 상태 전이: `agents: ACTIVE → DELETED` (soft delete)
- 부수효과: agent_secret_sequences soft delete, refresh_tokens revoke, unlock_sessions REVOKED, push_tokens soft delete, audit `USER_DELETE`

**Step 4.** 결과: AuthStack(LoginScreen) 이동
- 화면: SCR-001

**End state**: `agents.status=DELETED`

---

## 4. G6 게이트 자가 검증 — state_transition 전이 전체 커버 확인

state_transition_table.md 의 모든 전이 행이 ≥1 시나리오 step 에 등장하는지 검증:

### agents.status
| 전이 | 시나리오 |
|---|---|
| (없음) → ACTIVE (회원가입) | SCN-001 Step 2 ✓ |
| ACTIVE → DELETED (탈퇴) | SCN-018 Step 3 ✓ |

### agents.sequence_status
| 전이 | 시나리오 |
|---|---|
| (신규 생성) → NOT_REGISTERED | SCN-001 Step 2 ✓ |
| NOT_REGISTERED → REGISTERED (등록) | SCN-001 Step 5 ✓ |
| REGISTERED → REGISTERED (변경 self-loop) | SCN-011 Step 2 ✓ |
| REGISTERED → RESET_PENDING (reset 요청) | SCN-012 Step 2 ✓ |
| RESET_PENDING → REGISTERED (reset 완료) | SCN-012 Step 4 ✓ |
| RESET_PENDING → REGISTERED (30분 만료, system) | SCN-013 Step 2 ✓ |

### unlock_sessions.status
| 전이 | 시나리오 |
|---|---|
| (없음) → ACTIVE (시퀀스 검증 성공) | SCN-002 Step 3 ✓ |
| ACTIVE → EXPIRED (30분 만료, system) | SCN-007 Step 2 ✓ |
| ACTIVE → REVOKED (백그라운드 5초) | SCN-008 Step 2 ✓ |
| ACTIVE → REVOKED (앱 재시작 / 로그아웃 / reset 완료) | SCN-009 Step 2 (앱 재시작) ✓ / SCN-017 Step 2 (로그아웃) ✓ / SCN-012 Step 4 (reset 완료) ✓ |
| ACTIVE → REVOKED (페어 해제, system) | SCN-010 Step 3 ✓ |

### pairings.status
| 전이 | 시나리오 |
|---|---|
| (없음) → PAIRING_REQUESTED (요청 발송) | SCN-003 Step 3 ✓ |
| PAIRING_REQUESTED → PAIRED (수락) | SCN-003 Step 6 ✓ |
| PAIRING_REQUESTED → PAIRING_REJECTED (거부) | SCN-004 Step 5' ✓ |
| PAIRING_REQUESTED → DISCONNECTED (요청자 취소) | SCN-005 Step 2 ✓ |
| PAIRED → DISCONNECTED (해제) | SCN-010 Step 3 ✓ |

### messages.status
| 전이 | 시나리오 |
|---|---|
| (없음) → SENT (메시지 전송) | SCN-002 Step 5 ✓ |
| SENT → DELETED (90일 경과, system) | SCN-015 Step 1 ✓ |
| SENT → DELETED (페어 해제 cascade) | SCN-010 Step 3 ✓ |

### message_attachments.status
| 전이 | 시나리오 |
|---|---|
| (없음) → PENDING (업로드 시작) | SCN-006 Step 2 ✓ |
| PENDING → AVAILABLE (업로드 완료 + 매직바이트 + message 연결) | SCN-006 Step 3 ✓ |
| PENDING → DELETED (30분 미연결 / 매직바이트 실패, system) | SCN-014 Step 3 ✓ |
| AVAILABLE → DELETED (90일 경과 또는 페어 DISCONNECTED) | SCN-015 Step 3 (90일) ✓ / SCN-010 Step 3 (DISCONNECTED) ✓ |
| AVAILABLE → DELETED (메시지 DELETED cascade) | SCN-015 Step 2 ✓ |

### notification_queue.status
| 전이 | 시나리오 |
|---|---|
| (없음) → QUEUED (알림 트리거) | SCN-002 Step 5 ✓ |
| QUEUED → SENT (FCM 성공) | SCN-002 Step 6 ✓ |
| QUEUED → FAILED (FCM 실패) | SCN-016 Step 2 ✓ |

**총 29개 전이 행 전체 커버 — G6 게이트 충족.**

---

## 체크리스트

- [x] 사용자 유형별 ≥1 happy + ≥1 error 시나리오 — SCN-001/002/003/006 (happy), SCN-004/007/012/014/016 (error)
- [x] state_transition_table 의 모든 전이 행이 ≥1 시나리오 step 에 등장 (G6 게이트 — §4 검증 표)
- [x] 모든 step 의 화면이 screen_inventory 에 존재 (SCR-001~034)
- [x] 모든 step 의 액션이 api endpoint 와 매핑 (ACT-NNN → API URL)
- [x] 시나리오 ID `SCN-NNN`
- [x] happy / error / edge 유형 명시 (시나리오 목록 표 §2)
- [x] 시작 → 종료 상태 명시 (End state 각 시나리오 말미)

---

## 전제 / 우선순위 적용

- **단일 사용자 유형**: agent 1종. 모든 시나리오는 에이전트 관점 (PLAN-003 brief §3, permission_policy.md §3).
- **위장 유지 원칙**: unlock 실패 / 권한 거부 시나리오에서 외부 응답은 일반 기사 상세 또는 NEWS_ARTICLE_NOT_FOUND — 사용자 화면에 오류 메시지 없음.
- **system 전이 포함**: SCN-013/015/016 은 사용자 행동 없는 시스템 자동 전이. G6 게이트는 사용자 행동 여부와 무관하게 전이 행 등장 필수.
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-UX (Claude Sonnet 4.6) — PLAN-003-DOC-USER-SCENARIOS_
