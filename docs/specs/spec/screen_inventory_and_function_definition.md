# agentNews 화면 인벤토리 및 기능 정의 v1.0

---

## 1. 문서 목적

agentNews v1 의 모든 화면 목록, 각 화면의 표시 데이터·사용자 액션·API 매핑·상태별 표시를 정의한다.
menu_structure.md 의 모든 MENU-NNN 과 1:1 대응하며, G5 게이트 조건 (모든 사용자 액션 ≥1 api endpoint 매핑) 을 충족한다.

---

## 2. 화면 목록 표

| 화면 ID | 화면명 | Screen Name (RN) | 접근 권한 | 주요 액션 |
|---|---|---|---|---|
| SCR-001 | 로그인 | LoginScreen | 미인증 | 로그인, 회원가입 이동 |
| SCR-002 | 회원가입 | RegisterScreen | 미인증 | 회원가입 |
| SCR-003 | 시퀀스 reset | SequenceResetScreen | 미인증 (딥링크) | 새 시퀀스 등록 |
| SCR-010 | 뉴스 피드 | NewsFeedScreen | agent | 피드 조회, 기사 탭, 새로고침 |
| SCR-011 | 기사 상세 | ArticleDetailScreen | agent | 기사 조회, 시퀀스 unlock 시도 |
| SCR-020 | 채팅 | ChatScreen | agent + unlock_token 유효 + PAIRED | 채팅 송수신, 첨부, 페어 조회 |
| SCR-021 | 페어 검색 | PairingSearchScreen | agent + unlock_token 유효 | 사용자 조회, 페어링 요청 |
| SCR-022 | 페어링 확인 | PairingRequestScreen | agent + unlock_token 유효 | 수락·거부·취소 |
| SCR-030 | 설정 | SettingsScreen | agent | 프로필 조회, 로그아웃, 위장 테스트 |
| SCR-031 | 프로필 편집 | ProfileEditScreen | agent | 닉네임 변경, 탈퇴 |
| SCR-032 | 시퀀스 변경 | SequenceChangeScreen | agent | 시퀀스 변경 |
| SCR-033 | 시퀀스 reset 요청 | SequenceResetRequestScreen | agent (REGISTERED) | reset 링크 발송 |
| SCR-034 | 페어 해제 확인 | PairDisconnectScreen | agent (PAIRED) | 페어 해제 |

---

## 3. 화면 상세

---

### 3-1. SCR-001 로그인 (LoginScreen)

**진입 경로**: 앱 시작 시 미인증 / MainStack 에서 인증 만료 리디렉션

**표시 데이터**:
- 이메일 입력 필드
- 비밀번호 입력 필드
- (데이터 출처 없음 — 입력 폼)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-001 | 로그인 | "로그인" 버튼 탭 | `POST /api/v1/auth/login` | 성공 → MainStack(NewsFeedScreen) 이동. 실패 → 에러 메시지 |
| ACT-002 | 회원가입 이동 | "회원가입" 텍스트 탭 | (없음, route 이동) | SCR-002 push |
| ACT-003 | FCM 토큰 등록 (자동) | 로그인 성공 직후 자동 | `POST /api/v1/auth/push-token` | 위장 푸시 수신 활성화 |

**상태별 표시**:
- loading: "로그인" 버튼 비활성 + 스피너
- error(AUTH_INVALID_CREDENTIALS): "이메일 또는 비밀번호가 올바르지 않습니다."
- error(AUTH_VALIDATION_ERROR): 해당 필드 인라인 오류 표시

**권한별 노출 차이**: 없음 (미인증 전용 화면)

---

### 3-2. SCR-002 회원가입 (RegisterScreen)

**진입 경로**: SCR-001 → "회원가입" 탭

**표시 데이터**:
- 이메일, 비밀번호, 닉네임 입력 필드

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-010 | 회원가입 | "가입 완료" 버튼 탭 | `POST /api/v1/auth/signup` | 성공 → MainStack(NewsFeedScreen) + 시퀀스 미등록 안내. 실패 → 에러 메시지 |
| ACT-011 | FCM 토큰 등록 (자동) | 가입 성공 직후 자동 | `POST /api/v1/auth/push-token` | 위장 푸시 수신 활성화 |
| ACT-012 | 로그인으로 돌아가기 | "로그인" 텍스트 탭 | (없음, route 이동) | SCR-001 pop |

**상태별 표시**:
- loading: 버튼 비활성
- error(AUTH_EMAIL_DUPLICATE): "이미 사용 중인 이메일입니다."
- error(AUTH_VALIDATION_ERROR): 해당 필드 인라인 오류

**권한별 노출 차이**: 없음 (미인증 전용)

---

### 3-3. SCR-003 시퀀스 reset (SequenceResetScreen)

**진입 경로**: 이메일 reset 링크 딥링크 (앱 외부 탭)

**표시 데이터**:
- 딥링크에서 추출된 `resetToken` (URL 파라미터, 로컬 보관)
- 새 시퀀스 입력 UI (기사 탭 시뮬레이터 또는 숫자 입력)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-020 | 새 시퀀스 등록 | "등록 완료" 버튼 탭 | `POST /api/v1/sequence/reset-complete` | 성공 → LoginScreen 이동 (재로그인 안내). 실패(만료) → "링크가 만료됐습니다." |

**상태별 표시**:
- loading: 버튼 비활성
- error(SEQUENCE_RESET_LINK_EXPIRED): "링크가 만료됐습니다. 설정에서 다시 요청해주세요."
- error(SEQUENCE_VALIDATION_ERROR): "시퀀스 길이는 4~6개여야 합니다."

**권한별 노출 차이**: 없음 (reset_token 보유자 전용)

---

### 3-4. SCR-010 뉴스 피드 (NewsFeedScreen)

**진입 경로**: 로그인 성공 직후 / 탭바 [탭1] / 백그라운드 복귀 / ChatModal 닫힘

**표시 데이터**:
- 뉴스 기사 카드 목록 (출처: `GET /api/v1/news/feed` → articles[])
  - title, summary, thumbnailUrl, source, publishedAt (displayOrder 는 비표시)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-030 | 피드 초기 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/news/feed` | 기사 목록 표시 |
| ACT-031 | 피드 새로고침 | pull-to-refresh 제스처 | `POST /api/v1/news/feed/refresh` | 최신 기사 목록 갱신 |
| ACT-032 | 기사 카드 탭 | 기사 카드 tap | `GET /api/v1/news/articles/:articleId` → SCR-011 push | ArticleDetailScreen 진입 + 시퀀스 입력 기록 시작 |

**상태별 표시**:
- loading: 스켈레톤 카드 (최소 3개)
- empty: 표시 안 함 — fallback batch 가 보장되므로 empty 없음 (REQ-004)
- error(NEWS_API_UNAVAILABLE): "뉴스를 불러올 수 없습니다." (캐시 fallback 실패 시만)
- error(AUTH_TOKEN_EXPIRED): 자동 refresh 시도 → 실패 시 LoginScreen 리디렉션

**권한별 노출 차이**:
- agent: 피드 전체 표시. 시퀀스 미등록(NOT_REGISTERED) 시 상단 배너 "비밀 설정 필요"
- 미인증: LoginScreen 리디렉션

---

### 3-5. SCR-011 기사 상세 (ArticleDetailScreen)

**진입 경로**: SCR-010 → 기사 카드 탭

**표시 데이터**:
- 기사 메타 (출처: `GET /api/v1/news/articles/:articleId` → title, summary, url, thumbnailUrl, source, publishedAt)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-040 | 기사 상세 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/news/articles/:articleId` | 기사 메타 표시 |
| ACT-041 | 시퀀스 unlock 시도 (자동) | 기사 탭 → 시퀀스 완성 감지 시 백그라운드 자동 | `POST /api/v1/unlock/attempt` | 성공 → unlockToken 수령 → ChatScreen conditional swap. 실패 → 기사 상세 그대로 (위장, 오류 메시지 없음) |
| ACT-042 | 뒤로 가기 | 백버튼 / 스와이프 | (없음, route pop) | NewsFeedScreen 복귀 |

**상태별 표시**:
- loading: 기사 메타 스켈레톤
- error(NEWS_ARTICLE_NOT_FOUND): NewsFeedScreen 으로 자동 pop (기사 만료)
- 시퀀스 실패: 아무런 변화 없음 — 기사 상세 그대로 표시 (위장 유지, REQ-009)
- 시퀀스 성공: ChatModal 전환 (conditional swap — 별도 navigation push 없음)

**권한별 노출 차이**:
- agent + REGISTERED: 시퀀스 탭 추적 활성
- agent + NOT_REGISTERED: 기사 탭 추적 비활성 (시퀀스 미등록 안내는 피드에서만)

---

### 3-6. SCR-020 채팅 (ChatScreen)

**진입 경로**: SCR-011 → unlock 성공 시 conditional swap (ChatModal full-screen)

**표시 데이터**:
- 채팅 히스토리 (출처: `GET /api/v1/chat/history` → messages[{ externalId, senderExternalId, body, sentAt, attachment? }])
- 실시간 메시지 (출처: WebSocket `wss://<host>/ws` → `message:new` 이벤트)
- 상대방 닉네임·externalId (출처: `GET /api/v1/pairings/current` → counterpart)
- unlock 만료 시각 (출처: unlock/attempt 응답 → expiresAt)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-050 | WebSocket 연결 (자동) | 화면 mount 시 자동 | `wss://<host>/ws` (handshake: access + unlock) | 연결 성공 → 실시간 수신 활성. 실패 → 위장 404 (채팅 진입 차단) |
| ACT-051 | 채팅 히스토리 초기 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/chat/history` | 기존 메시지 표시 |
| ACT-052 | 페어 상태 조회 (자동) | 화면 mount 시 자동 | `GET /api/v1/pairings/current` | 상대방 정보 + 페어 상태 확인 |
| ACT-053 | 메시지 전송 | "전송" 버튼 탭 | `POST /api/v1/messages` | 메시지 전송 + 상대방에게 WebSocket push + 위장 푸시 큐잉 |
| ACT-054 | 이미지 첨부 | 이미지 피커 → 선택 완료 | `POST /api/v1/attachments` → `POST /api/v1/messages (attachmentExternalId)` | 이미지 업로드 → 메시지 전송 |
| ACT-055 | 파일 첨부 | 파일 피커 → 선택 완료 | `POST /api/v1/attachments` → `POST /api/v1/messages (attachmentExternalId)` | PDF 업로드 → 메시지 전송 |
| ACT-056 | 첨부 다운로드 | 첨부 썸네일 탭 | `GET /api/v1/attachments/:externalId/download-url` | presigned URL 발급 → OS가 파일 열기 |
| ACT-057 | unlock ping (자동) | 5초 주기 자동 | `POST /api/v1/unlock/ping` | last_seen_at 갱신. 실패(만료) → 뉴스 피드 강제 복귀 |
| ACT-058 | 히스토리 추가 로드 | 스크롤 최상단 도달 | `GET /api/v1/chat/history?cursor=...` | 이전 메시지 prepend |
| ACT-059 | 페어 검색 화면 이동 | "페어 찾기" 버튼 탭 (활성 페어 없을 때만) | (없음, route push) | SCR-021 push |

**상태별 표시**:
- loading(초기): 히스토리 스켈레톤 + "연결 중..." 상태 바
- empty(메시지 없음): "첫 번째 메시지를 보내보세요."
- PAIRED 이지만 상대방 오프라인: 정상 채팅 화면 (WebSocket push 수신 없음 — 위장 푸시로 알림)
- PAIRED 아님(페어 없음): PairingSearchScreen 유도 UI ("먼저 페어를 연결하세요.")
- error(unlock 만료/REVOKED): 자동으로 ChatModal 닫힘 + NewsFeedScreen 복귀 (REQ-023, REQ-024)
- error(pairing:disconnected 수신): ChatModal 닫힘 + NewsFeedScreen 복귀

**권한별 노출 차이**:
- agent + PAIRED + unlock 유효: 전체 채팅 UI
- agent + PAIRING_REQUESTED: 채팅 비활성 + 요청 대기 상태 표시 (SCR-022 자동 이동 또는 오버레이)
- agent + 활성 페어 없음: 채팅 비활성 + SCR-021 유도

---

### 3-7. SCR-021 페어 검색 (PairingSearchScreen)

**진입 경로**: SCR-020 → "페어 찾기" 버튼 (활성 페어 없을 때만)

**표시 데이터**:
- external_id 입력 필드
- 검색 결과 (출처: `GET /api/v1/users/lookup/:externalId` → { externalId, nickname })

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-060 | 사용자 조회 | "검색" 버튼 탭 | `GET /api/v1/users/lookup/:externalId` | 검색 결과 표시. 위장 404 → "사용자를 찾을 수 없습니다." |
| ACT-061 | 페어링 요청 발송 | "요청 보내기" 버튼 탭 | `POST /api/v1/pairings` | 성공 → SCR-022 push (대기 상태). 실패(위장 404) → "요청할 수 없습니다." |

**상태별 표시**:
- empty(검색 전): "상대방의 에이전트 ID를 입력하세요."
- loading(검색 중): 스피너
- empty(검색 결과 없음): "에이전트를 찾을 수 없습니다." (위장 404 대응)
- error(페어링 요청 실패): "요청을 보낼 수 없습니다." (위장 404 대응)

**권한별 노출 차이**: agent + unlock 유효 + 활성 페어 없음 시만 접근 가능

---

### 3-8. SCR-022 페어링 확인 (PairingRequestScreen)

**진입 경로**: SCR-021 → 요청 발송 성공 / SCR-020 → 페어링 요청 수신 알림 탭 → 시퀀스 입력 후 진입

**표시 데이터**:
- 현재 페어링 상태 (출처: `GET /api/v1/pairings/current` → { status, role, counterpart, requestedAt })
- role ('requester' | 'recipient') 에 따라 UI 분기

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-070 | 페어링 상태 조회 (자동) | 화면 mount 시 자동 | `GET /api/v1/pairings/current` | 현재 상태 표시 |
| ACT-071 | 수락 (recipient) | "수락" 버튼 탭 | `POST /api/v1/pairings/:externalId/accept` | 성공 → PAIRED → SCR-020 으로 복귀 (채팅 활성) |
| ACT-072 | 거부 (recipient) | "거부" 버튼 탭 | `POST /api/v1/pairings/:externalId/reject` | PAIRING_REJECTED → SCR-021 로 복귀 |
| ACT-073 | 요청 취소 (requester) | "취소" 버튼 탭 | `POST /api/v1/pairings/:externalId/cancel` | DISCONNECTED → SCR-021 로 복귀 |

**상태별 표시**:
- requester 뷰: "요청 대기 중... {counterpart.nickname}" + "취소" 버튼
- recipient 뷰: "{counterpart.nickname}님의 페어링 요청" + "수락" / "거부" 버튼
- loading: 버튼 비활성 + 스피너
- error(위장 404): "처리할 수 없습니다." (위장 처리)

**권한별 노출 차이**: role(requester/recipient) 에 따라 버튼 분기

---

### 3-9. SCR-030 설정 (SettingsScreen)

**진입 경로**: 탭바 [탭2]

**표시 데이터**:
- 본인 프로필 (출처: `GET /api/v1/users/me` → { externalId, email, nickname, sequenceStatus, activePairing })
- 알림 상태 (출처: `GET /api/v1/notifications/preferences` → { activeTokenCount, lastSentAt, failedLast24h })

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-080 | 프로필 데이터 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/users/me` | 본인 정보 표시 |
| ACT-081 | 알림 상태 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/notifications/preferences` | 알림 상태 표시 |
| ACT-082 | 프로필 편집 이동 | "프로필 편집" 탭 | (없음, route push) | SCR-031 push |
| ACT-083 | 시퀀스 변경 이동 | "시퀀스 변경" 탭 | (없음, route push) | SCR-032 push |
| ACT-084 | 시퀀스 reset 요청 이동 | "시퀀스 분실" 탭 | (없음, route push) | SCR-033 push |
| ACT-085 | 페어 해제 이동 | "페어 해제" 탭 | (없음, route push) | SCR-034 push |
| ACT-086 | 위장 테스트 발송 | "위장 테스트" 버튼 탭 | `POST /api/v1/notifications/dry-run` | 본인 기기에 위장 푸시 즉시 발송 |
| ACT-087 | 로그아웃 | "로그아웃" 버튼 탭 | `POST /api/v1/auth/logout` | refresh 무효화 + 로컬 keychain 삭제 → AuthStack(LoginScreen) 이동 |

**상태별 표시**:
- loading: 스켈레톤 프로필 카드
- sequenceStatus=NOT_REGISTERED: "비밀 시퀀스 미등록" 배지 + 등록 유도
- activePairing=PAIRING_REQUESTED: "페어링 요청 대기 중" 배지
- activePairing=PAIRED: 상대방 닉네임 표시

**권한별 노출 차이**:
- sequenceStatus=NOT_REGISTERED: "시퀀스 변경" → "시퀀스 등록" 으로 변경, "시퀀스 분실" 항목 숨김
- activePairing=null: "페어 해제" 항목 숨김

---

### 3-10. SCR-031 프로필 편집 (ProfileEditScreen)

**진입 경로**: SCR-030 → "프로필 편집" 탭

**표시 데이터**:
- 현재 닉네임, externalId (출처: `GET /api/v1/users/me`)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-090 | 프로필 데이터 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/users/me` | 현재 닉네임 표시 |
| ACT-091 | 닉네임 변경 저장 | "저장" 버튼 탭 | `PATCH /api/v1/users/me` | 성공 → 닉네임 갱신 후 SCR-030 pop. 실패 → 인라인 에러 |
| ACT-092 | 계정 탈퇴 | "탈퇴" 버튼 탭 → 비밀번호 확인 모달 | `DELETE /api/v1/users/me` | 성공 → AuthStack(LoginScreen). 활성 페어 존재 시 → "먼저 페어를 해제해주세요." |

**상태별 표시**:
- loading: 버튼 비활성
- error(USER_VALIDATION_ERROR): "닉네임은 1~40자여야 합니다."
- error(USER_ACTIVE_PAIR_EXISTS): "먼저 페어를 해제해주세요." (탈퇴 시)
- error(AUTH_INVALID_CREDENTIALS): "비밀번호가 올바르지 않습니다." (탈퇴 확인 시)

**권한별 노출 차이**: 없음 (agent 전용)

---

### 3-11. SCR-032 시퀀스 변경 (SequenceChangeScreen)

**진입 경로**: SCR-030 → "시퀀스 변경" 탭

**표시 데이터**:
- 현재 시퀀스 상태 (출처: `GET /api/v1/users/me` → sequenceStatus)
- 현재 시퀀스 입력 필드 (재인증용)
- 새 시퀀스 입력 필드

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-100 | 현재 상태 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/users/me` | sequenceStatus 확인 |
| ACT-101 | 시퀀스 변경 저장 | "변경" 버튼 탭 | `PATCH /api/v1/sequence` | 성공 → SCR-030 pop. 실패(현재 시퀀스 불일치) → "현재 시퀀스가 일치하지 않습니다." |

**상태별 표시**:
- loading: 버튼 비활성
- error(SEQUENCE_VERIFY_REQUIRED): "현재 시퀀스가 일치하지 않습니다."
- error(SEQUENCE_VALIDATION_ERROR): "시퀀스는 4~6개 숫자여야 합니다."
- sequenceStatus=NOT_REGISTERED: 현재 시퀀스 입력 필드 숨김 → `POST /api/v1/sequence` 호출 (최초 등록)

**권한별 노출 차이**:
- NOT_REGISTERED: 현재 시퀀스 입력 없음 (최초 등록 모드) → `POST /api/v1/sequence`
- REGISTERED: 현재 + 새 시퀀스 모두 입력 필요 → `PATCH /api/v1/sequence`

추가 액션 (NOT_REGISTERED 모드):

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-102 | 시퀀스 최초 등록 | "등록" 버튼 탭 (NOT_REGISTERED 모드) | `POST /api/v1/sequence` | 성공 → REGISTERED → SCR-030 pop |

---

### 3-12. SCR-033 시퀀스 reset 요청 (SequenceResetRequestScreen)

**진입 경로**: SCR-030 → "시퀀스 분실" 탭 (REGISTERED 상태에서만 노출)

**표시 데이터**:
- 본인 이메일 (출처: `GET /api/v1/users/me` → email — 발송 대상 확인용)

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-110 | 이메일 확인 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/users/me` | 본인 이메일 표시 |
| ACT-111 | reset 링크 발송 | "이메일로 reset 링크 발송" 버튼 탭 | `POST /api/v1/sequence/reset-request` | 성공 → "이메일을 확인해주세요." + SCR-030 pop. RESET_PENDING 이면 비활성 안내 |

**상태별 표시**:
- loading: 버튼 비활성
- error(SEQUENCE_NOT_REGISTERED): 접근 불가 (SCR-030 에서 항목 숨김으로 사전 차단)
- 발송 성공: "이메일을 확인해주세요. 링크는 30분 후 만료됩니다." + 자동 pop

**권한별 노출 차이**: REGISTERED 상태에서만 SCR-030 에서 진입 가능 (RESET_PENDING 이면 "이미 발송됨" 표시)

---

### 3-13. SCR-034 페어 해제 확인 (PairDisconnectScreen)

**진입 경로**: SCR-030 → "페어 해제" 탭 (PAIRED 상태에서만 노출)

**표시 데이터**:
- 현재 페어 상대 닉네임 (출처: `GET /api/v1/pairings/current` → counterpart.nickname)
- 해제 경고 문구 ("페어 해제 시 모든 대화 내용이 즉시 삭제됩니다.")

**사용자 액션**:

| 액션 ID | 라벨 | 트리거 | 호출 API | 결과 |
|---|---|---|---|---|
| ACT-120 | 페어 정보 로드 (자동) | 화면 mount 시 자동 | `GET /api/v1/pairings/current` | 상대방 닉네임 + pairing externalId 표시 |
| ACT-121 | 페어 해제 확인 | "해제 확인" 버튼 탭 | `POST /api/v1/pairings/:externalId/disconnect` | 성공 → DISCONNECTED → 양측 메시지/첨부 즉시 삭제 → SCR-030 pop (ChatModal 도 닫힘) |

**상태별 표시**:
- loading: 버튼 비활성
- error(위장 404): "처리할 수 없습니다."
- 해제 성공: SCR-030 으로 pop + "페어가 해제됐습니다." toast

**권한별 노출 차이**: PAIRED 상태에서만 접근 가능 (SCR-030 에서 사전 차단)

---

## 4. G5 게이트 자가 검증

모든 사용자 액션(route 이동 제외)이 ≥1 api endpoint 와 매핑됐는지 검증:

| 화면 | 액션 ID | 매핑 API | 충족 |
|---|---|---|---|
| SCR-001 | ACT-001 | POST /auth/login | ✓ |
| SCR-001 | ACT-003 | POST /auth/push-token | ✓ |
| SCR-002 | ACT-010 | POST /auth/signup | ✓ |
| SCR-002 | ACT-011 | POST /auth/push-token | ✓ |
| SCR-003 | ACT-020 | POST /sequence/reset-complete | ✓ |
| SCR-010 | ACT-030 | GET /news/feed | ✓ |
| SCR-010 | ACT-031 | POST /news/feed/refresh | ✓ |
| SCR-010 | ACT-032 | GET /news/articles/:articleId | ✓ |
| SCR-011 | ACT-040 | GET /news/articles/:articleId | ✓ |
| SCR-011 | ACT-041 | POST /unlock/attempt | ✓ |
| SCR-020 | ACT-050 | wss://<host>/ws | ✓ |
| SCR-020 | ACT-051 | GET /chat/history | ✓ |
| SCR-020 | ACT-052 | GET /pairings/current | ✓ |
| SCR-020 | ACT-053 | POST /messages | ✓ |
| SCR-020 | ACT-054 | POST /attachments → POST /messages | ✓ |
| SCR-020 | ACT-055 | POST /attachments → POST /messages | ✓ |
| SCR-020 | ACT-056 | GET /attachments/:externalId/download-url | ✓ |
| SCR-020 | ACT-057 | POST /unlock/ping | ✓ |
| SCR-020 | ACT-058 | GET /chat/history?cursor=... | ✓ |
| SCR-021 | ACT-060 | GET /users/lookup/:externalId | ✓ |
| SCR-021 | ACT-061 | POST /pairings | ✓ |
| SCR-022 | ACT-070 | GET /pairings/current | ✓ |
| SCR-022 | ACT-071 | POST /pairings/:externalId/accept | ✓ |
| SCR-022 | ACT-072 | POST /pairings/:externalId/reject | ✓ |
| SCR-022 | ACT-073 | POST /pairings/:externalId/cancel | ✓ |
| SCR-030 | ACT-080 | GET /users/me | ✓ |
| SCR-030 | ACT-081 | GET /notifications/preferences | ✓ |
| SCR-030 | ACT-086 | POST /notifications/dry-run | ✓ |
| SCR-030 | ACT-087 | POST /auth/logout | ✓ |
| SCR-031 | ACT-090 | GET /users/me | ✓ |
| SCR-031 | ACT-091 | PATCH /users/me | ✓ |
| SCR-031 | ACT-092 | DELETE /users/me | ✓ |
| SCR-032 | ACT-100 | GET /users/me | ✓ |
| SCR-032 | ACT-101 | PATCH /api/v1/sequence | ✓ |
| SCR-032 | ACT-102 | POST /api/v1/sequence | ✓ |
| SCR-033 | ACT-110 | GET /users/me | ✓ |
| SCR-033 | ACT-111 | POST /sequence/reset-request | ✓ |
| SCR-034 | ACT-120 | GET /pairings/current | ✓ |
| SCR-034 | ACT-121 | POST /pairings/:externalId/disconnect | ✓ |

**총 39개 API 매핑 액션 — G5 게이트 충족.**

---

## 체크리스트

- [x] 모든 menu_structure 의 메뉴 (MENU-001 ~ MENU-034, 13개) 가 ≥1 화면과 매핑
- [x] 모든 화면 액션이 ≥1 api endpoint 와 매핑 (G5 게이트 — §4 검증 표)
- [x] 각 화면에 empty / loading / error 상태 명시
- [x] 권한별 노출 차이 (unlock_token 조건, PAIRED 조건, sequenceStatus 조건 모두 반영)
- [x] 화면 ID `SCR-NNN`, 액션 ID `ACT-NNN`
- [x] api endpoint 의 응답 필드가 표시 데이터 항목을 커버

---

## 전제 / 우선순위 적용

- **단일 사용자 유형**: agent 1종. admin/anonymous 화면 없음 (permission_policy.md §3).
- **위장 응답 반영**: 위장 응답 도메인 (pairing, message, attachment, unlock) 의 에러는 화면에서 "처리할 수 없습니다." 등 중립 표현만 사용.
- **ChatScreen conditional swap**: DECISIONS.md v1.1 — ArticleDetailScreen 내부에서 조건부 렌더링. 별도 navigation push 없음.
- **자동 액션 포함**: mount 시 자동 호출 (피드 로드, WebSocket 연결 등) 도 G5 게이트 충족을 위해 액션 표에 포함 (트리거 = "화면 mount 시 자동").
- **탈퇴 조건 (USER_ACTIVE_PAIR_EXISTS)**: 활성 페어 존재 시 DELETE /users/me 차단. 화면에서 "먼저 페어를 해제해주세요." 안내.
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-UX (Claude Sonnet 4.6) — PLAN-003-DOC-SCREEN-INVENTORY_
