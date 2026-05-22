# agentNews 요구사항 명세서 v1.0

---

## 1. 문서 목적

agentNews 는 일반 뉴스앱으로 위장된 1:1 비밀 채팅 SaaS 의 v1 범위 요구사항을 정의한다.
본 문서는 기능·비기능·보안 요구사항의 기준선으로, 이후 설계·개발·검증의 근거가 된다.

---

## 2. 시스템 범위

### 2-1. 포함 범위

1. 이메일+비밀번호 회원가입 및 로그인
2. JWT 기반 세션 관리 (access + refresh)
3. 뉴스 피드 — 외부 무료 뉴스 API 연동 및 표시
4. 비밀 시퀀스 등록·검증·분실 복구
5. 채팅 화면 진입 (시퀀스 성공 시 전환)
6. 위장 유지 (백그라운드·재시작 시 뉴스 피드 표시)
7. 사용자 ID 검색 (페어링 대상 조회)
8. 페어링 요청·수락·거부·해제
9. 1:1 실시간 채팅 (WebSocket)
10. 채팅 메시지 서버측 암호화 (AES-256-GCM)
11. 메시지 보존 90일 및 자동 삭제
12. 사진·파일 첨부 업로드·다운로드 (MinIO)
13. 위장 FCM 푸시 알림 ("📰 새 뉴스")
14. 감사 로그 (audit_logs) append-only 기록

### 2-2. 범위 원칙

- 뉴스앱 위장 유지: 모든 오류·권한 거부 응답은 외부에서 일반 뉴스 응답과 구분 불가 형태로 반환
- 단일 사용자 유형 (에이전트) — admin/비회원 구분 없음
- 1 에이전트 = 최대 1 활성 페어 (동시 복수 페어 불가)

---

## 3. 시스템 정의

agentNews 는 다음 세 계층으로 구성된다.

- **모바일 앱 (React Native + TypeScript)**: 뉴스 피드 및 비밀 채팅 인터페이스. Apple HIG 기준 iOS 우선 디자인. URL bar 없음 → 라우트 평문 노출 없음.
- **백엔드 서버 (NestJS, Clean Architecture 4계층)**: API 서버 + WebSocket 서버. PostgreSQL 16 DB. TypeORM 사용, raw query 금지.
- **인프라 (Docker self-host)**: 백엔드 docker-compose, MinIO (S3 호환 첨부 저장소). 모바일 배포: TestFlight (iOS) + Firebase App Distribution (Android).

외부 연동: 뉴스 API (무료 tier), FCM (Firebase Cloud Messaging).

---

## 4. 사용자 유형

| 유형 | 설명 | 진입 방법 |
|---|---|---|
| **에이전트** | 이메일+비밀번호로 가입한 회원. 뉴스 열람 + 비밀 시퀀스 입력 후 채팅 가능 | 앱 다운로드 → 이메일 가입 |

비회원(anonymous) 및 관리자(admin) 는 v1 범위 밖. 운영 작업은 직접 DB/서버 접근으로 처리.

---

## 5. 기능 요구사항

### 5-1. 인증 / 세션

---

### REQ-001 이메일+비밀번호 회원가입

**설명**: 에이전트는 이메일 주소와 비밀번호를 입력해 계정을 생성한다. 이메일은 시스템 내 유일해야 하며, 비밀번호는 bcrypt cost 12 로 해싱해 저장한다.

**acceptance criteria**:
- 이메일 형식 위반 또는 중복 이메일로 가입 시 명확한 오류 반환
- 비밀번호는 DB에 평문으로 저장되지 않는다 (bcrypt hash 컬럼만 존재)
- 가입 성공 시 access token + refresh token 발급

---

### REQ-002 로그인 및 JWT 세션

**설명**: 에이전트는 이메일+비밀번호로 로그인한다. 서버는 access token (15분) 과 refresh token 을 발급한다. 토큰은 react-native-keychain 에 저장되며 httpOnly cookie 사용 안 함.

**acceptance criteria**:
- access token 만료 시 refresh token 으로 재발급 가능
- refresh token 재발급 요청은 `X-Refresh-Token` 헤더 사용
- 잘못된 자격증명으로 로그인 시 401 반환 (메시지는 위장 불필요 — 앱 내부 화면)

**연관**: REQ-001

---

### REQ-003 로그아웃

**설명**: 에이전트는 설정 화면에서 로그아웃할 수 있다. 로그아웃 시 서버측 refresh token 무효화 및 기기 keychain 에서 토큰 삭제.

**acceptance criteria**:
- 로그아웃 후 동일 refresh token 으로 재발급 시 401 반환
- 기기 keychain 에 토큰이 남아있지 않음

---

### 5-2. 뉴스 피드

---

### REQ-004 외부 뉴스 API 연동

**설명**: 백엔드는 외부 무료 뉴스 API (GNews / MediaStack / NewsAPI.org 중 선정) 를 통해 뉴스 기사 목록을 가져온다. 캐시 TTL 10분.

**acceptance criteria**:
- 뉴스 API 호출 실패 시 최근 캐시 데이터 반환 (fallback). 빈 피드 표시 안 함
- 뉴스 기사는 노출 순서(top N) 기준으로 인덱스가 부여됨 (1번 = 피드 최상단)
- 캐시 갱신 주기 10분 이내

---

### REQ-005 뉴스 피드 표시

**설명**: 앱 시작 및 백그라운드 복귀 시 항상 뉴스 피드 화면을 표시한다. 기사 카드 탭 시 기사 상세 표시 (비밀 시퀀스 입력 진입점이기도 함).

**acceptance criteria**:
- 앱 최초 화면 = 뉴스 피드 (채팅 화면이 절대 먼저 보이지 않음)
- 기사 카드는 노출 순서 인덱스를 시각적으로 노출하지 않음 (위장 유지)

**연관**: REQ-004, REQ-026

---

### 5-3. 비밀 시퀀스

---

### REQ-006 비밀 시퀀스 등록

**설명**: 에이전트는 가입 후 최초 1회 비밀 시퀀스를 등록한다. 시퀀스는 뉴스 피드 노출 순서 기준 기사 인덱스 4~6개의 배열이다. 예: [5, 3, 1, 7]. 변경은 설정 화면에서 현재 시퀀스 재입력 인증 후 가능.

**acceptance criteria**:
- 시퀀스는 HMAC-SHA256 해시 + 16바이트 salt 형태로 저장 (평문 저장 금지)
- 길이 4 미만 또는 7 이상 시퀀스는 등록 거부
- 시퀀스 변경 시 기존 시퀀스를 정확히 입력해야 변경 허용

---

### REQ-007 비밀 시퀀스 검증 및 채팅 진입

**설명**: 에이전트가 뉴스 피드에서 등록한 시퀀스 순서대로 기사를 탭하면 비밀 채팅 화면으로 전환된다. 시퀀스 성공 시 unlock_token (30분 유효) 발급.

**acceptance criteria**:
- 올바른 시퀀스 입력 시 채팅 화면 전환. unlock_token 을 `X-Unlock-Token` 헤더로 사용
- 잘못된 시퀀스 입력 시 뉴스 앱이 정상 동작하는 것처럼 보임 (위장 유지). 오류 메시지 표시 안 함
- 1초 이내 동일 기사 재탭은 무시 (rate limit)
- unlock_token 만료(30분) 후 채팅 API 호출 시 401 반환 → 자동으로 뉴스 피드로 이동

**연관**: REQ-006, REQ-009

---

### REQ-008 비밀 시퀀스 분실 복구

**설명**: 에이전트가 시퀀스를 기억하지 못할 경우 이메일 인증 기반으로 시퀀스를 초기화하고 재등록할 수 있다.

**acceptance criteria**:
- 이메일로 reset 링크 발송. 링크는 30분 유효
- reset 완료 시 기존 시퀀스 무효화. 페어는 유지, 채팅 히스토리는 보존
- reset 후 새 시퀀스 재등록 완료까지 채팅 진입 불가

**연관**: REQ-006

---

### REQ-009 위장 유지 — 시퀀스 실패

**설명**: 잘못된 시퀀스 입력, 미등록 사용자의 채팅 API 호출 등 모든 권한 거부 상황에서 외부에서 봤을 때 일반 뉴스앱 동작과 구분 불가해야 한다.

**acceptance criteria**:
- 시퀀스 실패 시 앱은 기사 상세 화면을 정상 표시 (에러 팝업 없음)
- 인증 없는 채팅 API 호출 시 응답은 `404 NEWS_ARTICLE_NOT_FOUND` 형식
- 서버 응답 구조·헤더가 일반 뉴스 API 응답과 외부에서 식별 불가

**연관**: REQ-007

---

### 5-4. 페어링

---

### REQ-010 사용자 ID 검색

**설명**: 에이전트는 채팅 모드에서 상대방의 노출 ID (external_id, uuid 형식) 로 다른 에이전트를 검색할 수 있다. 이메일은 검색 키로 사용 불가.

**acceptance criteria**:
- 자기 자신은 검색 결과에 반환되지 않음
- 이미 활성 페어 중인 에이전트는 검색 결과에 반환되지 않음
- 검색 결과에는 노출 ID 와 공개 프로필(닉네임 등)만 포함. 이메일 미포함

---

### REQ-011 페어링 요청

**설명**: 에이전트는 검색된 상대방에게 페어링 요청을 발송한다. 상태: `PAIRING_REQUESTED`.

**acceptance criteria**:
- 요청 발송 후 상대방에게 FCM 위장 알림 발송
- 동시에 활성 페어(PAIRED 또는 PAIRING_REQUESTED 상태)가 있으면 새 요청 불가 (오류 반환)
- 요청 발신자는 응답 대기 상태로 표시

**연관**: REQ-012, REQ-014

---

### REQ-012 페어링 수락 / 거부

**설명**: 페어링 요청을 받은 에이전트는 채팅 모드 내에서 수락 또는 거부할 수 있다.

**acceptance criteria**:
- 수락 시 양측 상태 = `PAIRED`. 채팅 채널 즉시 활성화
- 거부 시 상태 = `PAIRING_REJECTED`. 요청자에게 위장 알림으로 거부 통지
- 수락/거부 모두 Idempotency-Key 헤더 적용 (중복 처리 방지)

**연관**: REQ-011

---

### REQ-013 페어링 해제

**설명**: 에이전트는 현재 페어를 해제(DISCONNECTED) 할 수 있다. 해제 시 양측 메시지 및 첨부파일 즉시 삭제.

**acceptance criteria**:
- 해제 시 pairings 상태 = `DISCONNECTED`
- 양측의 모든 메시지(soft delete 포함 전체)와 MinIO 첨부파일 즉시 삭제
- 해제 후 새 페어링 요청 가능

**연관**: REQ-011, REQ-014

---

### REQ-014 1 active pair 제약

**설명**: 에이전트 1인은 동시에 1개의 활성 페어(PAIRING_REQUESTED 또는 PAIRED 상태)만 보유할 수 있다.

**acceptance criteria**:
- 이미 활성 페어가 있는 상태에서 새 페어링 요청 시 서버에서 거부
- 기존 페어를 DISCONNECTED 한 후에만 새 요청 발송 가능
- DB 레벨 constraint 또는 트랜잭션으로 race condition 방지

**연관**: REQ-011, REQ-013

---

### 5-5. 채팅

---

### REQ-015 1:1 실시간 채팅 (WebSocket)

**설명**: PAIRED 상태의 에이전트 쌍은 WebSocket 을 통해 실시간 1:1 채팅을 할 수 있다. 채팅은 시퀀스 인증(unlock_token) 이 유효한 동안만 가능.

**acceptance criteria**:
- WebSocket handshake 시 서버가 자동으로 해당 pairing 채널에 join. client 측 subscribe/join 이벤트 거부
- unlock_token 만료 시 WebSocket 연결 서버에서 종료 (클라이언트 자동 뉴스 피드 이동)
- PAIRED 상태가 아닌 경우 WebSocket 채널 접근 불가

**연관**: REQ-007, REQ-012

---

### REQ-016 메시지 전송 및 수신

**설명**: 에이전트는 텍스트 메시지를 전송하고 페어로부터 수신한다. 모든 메시지 본문은 AES-256-GCM 으로 서버측 암호화하여 저장한다.

**acceptance criteria**:
- 메시지 본문은 DB에 암호화된 형태로 저장 (평문 저장 금지)
- 암호화 키는 환경변수 `MESSAGE_ENC_KEY` (단일 서버측 키)
- 전송 성공 시 발신자에게 확인 응답. Idempotency-Key 헤더 적용

**연관**: REQ-015

---

### REQ-017 메시지 보존 90일 및 자동 삭제

**설명**: 메시지는 전송 후 90일이 지나면 자동 삭제된다. soft delete 기본 (deleted_at). 페어 해제 시 즉시 삭제.

**acceptance criteria**:
- 90일 초과 메시지 배치(또는 스케줄러)로 자동 삭제
- 페어 해제(DISCONNECTED) 시 해당 페어의 모든 메시지 즉시 삭제
- 삭제된 메시지는 클라이언트에 표시되지 않음

**연관**: REQ-013, REQ-016

---

### 5-6. 첨부파일

---

### REQ-018 첨부파일 업로드

**설명**: 에이전트는 채팅 중 사진(react-native-image-picker) 또는 파일(react-native-document-picker) 을 첨부할 수 있다. 저장소는 MinIO (S3 호환).

**acceptance criteria**:
- 허용 MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf` (4종)
- 매직바이트 검증 수행. MIME 헤더와 실제 바이트 불일치 시 업로드 거부
- 이미지 최대 크기 10MB, PDF 최대 크기 25MB. 초과 시 업로드 거부
- 업로드 성공 전 메시지 전송 가능 (attachment 가 message 이전 upload 가능)

**연관**: REQ-016

---

### REQ-019 첨부파일 다운로드

**설명**: 에이전트는 수신된 첨부파일을 다운로드·열람할 수 있다. 다운로드 URL 은 서명된 임시 URL (presigned URL) 형태.

**acceptance criteria**:
- presigned URL 은 30분 이내 만료
- 페어가 아닌 사용자는 첨부파일 URL 접근 불가 (403 반환)
- IDOR 차단: 외부 API 는 internal bigserial id 아닌 external_id(uuid) 사용

**연관**: REQ-018

---

### REQ-020 첨부파일 보존 및 삭제

**설명**: 첨부파일은 메시지와 동일한 보존 정책(90일)을 따른다. 메시지 삭제 또는 페어 해제 시 MinIO 에서 즉시 물리 삭제.

**acceptance criteria**:
- 90일 초과 첨부파일 배치로 MinIO 에서 물리 삭제 (hard delete)
- 페어 해제 시 해당 페어 첨부파일 MinIO 에서 즉시 삭제
- 삭제된 첨부파일의 presigned URL 로 접근 시 404 반환

**연관**: REQ-013, REQ-017

---

### 5-7. 위장 알림

---

### REQ-021 FCM 위장 푸시 알림

**설명**: 메시지 수신 시 수신자 기기에 FCM 푸시를 발송한다. 알림 제목·본문은 뉴스 헤드라인으로 위장한다.

**acceptance criteria**:
- 알림 제목: `📰 새 뉴스 — {랜덤 가짜 헤드라인}` (텍스트 메시지)
- 알림 제목: `📰 새 뉴스 사진 — {랜덤 가짜 헤드라인}` (사진 첨부)
- 알림 제목: `📰 새 뉴스 자료 — {랜덤 가짜 헤드라인}` (PDF/파일 첨부)
- 가짜 헤드라인 풀은 서버 DB 에 한국어 50개 이상 보관. 발송 시 임의 선택
- 알림 data payload = 0 (data-only / silent push 금지)

**연관**: REQ-016, REQ-018

---

### REQ-022 알림 발송 시각 jitter

**설명**: 메시지 전송 시각과 알림 발송 시각 사이에 0~60초 무작위 지연을 적용한다. 패턴 분석에 의한 채팅 노출 방지.

**acceptance criteria**:
- 알림 발송 지연 0~60초 균등 분포 난수
- 지연이 적용되더라도 알림은 반드시 발송됨 (유실 없음)

**연관**: REQ-021

---

### 5-8. 위장 유지 — 화면 전환

---

### REQ-023 백그라운드 진입 시 뉴스 피드 복귀

**설명**: 채팅 화면 활성 중 앱이 백그라운드로 전환되면 5초 이내 자동으로 채팅 화면을 닫고 뉴스 피드로 복귀한다.

**acceptance criteria**:
- 백그라운드 전환 후 5초 이상 경과 시 앱 foreground 복귀 시 뉴스 피드 표시
- 5초 미만 전환은 채팅 화면 유지 가능
- 복귀 시 채팅 화면의 메시지 내용이 일시적으로라도 노출되지 않음

**연관**: REQ-007

---

### REQ-024 앱 재시작 시 채팅 화면 표시 안 함

**설명**: 앱 종료 후 재시작 시 항상 뉴스 피드 화면부터 표시한다. 자동 로그인은 유지하되, 채팅 화면은 절대 먼저 표시되지 않는다.

**acceptance criteria**:
- 앱 재시작 후 최초 화면 = 뉴스 피드 (예외 없음)
- unlock_token 은 앱 재시작 시 무효화 (새 시퀀스 입력 필요)
- 이전 세션의 채팅 화면 상태가 복원되지 않음

**연관**: REQ-005, REQ-007

---

### 5-9. 감사 로그

---

### REQ-025 감사 로그 append-only 기록

**설명**: 보안·운영 관련 주요 이벤트를 audit_logs 테이블에 기록한다. 한 번 기록된 로그는 수정·삭제 불가.

**acceptance criteria**:
- DB 트리거로 audit_logs UPDATE / DELETE 차단 (시도 시 오류 반환)
- 기록 이벤트 최소 포함: 로그인, 시퀀스 입력(성공/실패), 페어링 상태 변경, 메시지 삭제, 첨부파일 삭제
- audit_logs 보존 기간 1년 (이후 배치 삭제)

---

## 6. 비기능 요구사항

### NFR-001 응답시간

- API 응답시간 p95 < 500ms (뉴스 API 외부 호출 제외)

### NFR-002 가용성

- 서비스 가용성 95% 이상 (월 기준). Docker self-host 단일 서버 기준.

### NFR-003 데이터 보존

- 메시지 및 첨부파일: 90일 (이후 자동 삭제)
- audit_logs: 1년
- secret_sequence_attempts: 기록 불필요 (rate limit 전용 — 서버 메모리 또는 Redis)
- 캐시 TTL: 10분

### NFR-004 동시 사용자

- 초기 대상: 에이전트 6명 (3 페어). 성능 목표는 해당 규모 기준.

### NFR-005 배포 환경

- 백엔드: Docker + docker-compose. 단일 서버 self-host
- 모바일: iOS TestFlight (Apple Developer Program $99/yr) + Android Firebase App Distribution
- 스토리지: MinIO (Docker self-host)

---

## 7. 보안 / 법규

### SEC-001 비밀번호 해싱

bcrypt cost 12. 평문 비밀번호 DB 저장 금지.

### SEC-002 메시지 암호화

AES-256-GCM 서버측 단일키 (`MESSAGE_ENC_KEY` 환경변수). E2E 암호화는 v1 범위 밖.

### SEC-003 JWT 토큰 관리

- access token 유효기간 15분
- refresh token 을 통한 재발급 (`X-Refresh-Token` 헤더)
- unlock_token (시퀀스 인증) 유효기간 30분 (`X-Unlock-Token` 헤더)
- 토큰 기기 저장: react-native-keychain (httpOnly cookie 사용 금지)

### SEC-004 IDOR 차단

pairings, messages, message_attachments, notification_queue 테이블에 external_id(uuid) 컬럼 부여. 외부 API 응답은 internal bigserial 대신 external_id 사용.

### SEC-005 WebSocket 보안

WebSocket handshake 후 서버가 자동으로 `pairing:<pairing_id>` 채널에 join. 클라이언트 subscribe/join 이벤트 handler 거부.

### SEC-006 위장 응답

권한 거부 응답은 `404 NEWS_ARTICLE_NOT_FOUND` 형식. 외부에서 일반 뉴스 API 응답과 구분 불가.

### SEC-007 첨부파일 검증

업로드 시 매직바이트 검증. MIME allow-list 4종 (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`). 허용 외 파일 거부.

### SEC-008 API 멱등성

POST/PUT/DELETE 요청에 `Idempotency-Key` 헤더 적용. 중복 처리 방지.

### SEC-009 시퀀스 해시 저장

비밀 시퀀스는 HMAC-SHA256 (salt 16바이트) 형태로 저장. 평문 및 가역 형태 저장 금지.

### SEC-010 감사 로그 불변성

audit_logs 테이블 UPDATE/DELETE DB 트리거 차단. append-only 강제.

---

## 8. 외부 시스템 연동

| 시스템 | 역할 | 연동 방식 |
|---|---|---|
| 뉴스 API (GNews / MediaStack / NewsAPI.org 중 선정) | 뉴스 기사 목록 제공 | REST (HTTP GET, API Key) |
| FCM (Firebase Cloud Messaging) | iOS/Android 위장 푸시 알림 발송 | firebase-admin SDK (백엔드) |
| MinIO | 첨부파일 오브젝트 스토리지 | S3 호환 REST (aws-sdk / @aws-sdk/client-s3) |

---

## 9. 가정 / 제약 / 비-목표

### 가정

| ID | 내용 | 출처 |
|---|---|---|
| A-001 | 비밀 시퀀스는 에이전트 본인이 등록. 뉴스 피드 노출 순서(top N) 기준 인덱스. 길이 4~6개 | intake G-1 |
| A-002 | 시퀀스 분실 복구 = 이메일 인증 reset. reset 후 페어 유지, 히스토리 보존 | intake G-1 |
| A-003 | 백그라운드 5초 이상 시 채팅 자동 종료. 앱 재시작 시 채팅 화면 표시 안 함 | intake G-2 |
| A-004 | 채팅 히스토리 90일 보존. 페어 해제 시 양측 메시지·첨부 즉시 삭제 | intake G-2 |
| A-005 | 첨부 저장소 = MinIO (Docker self-host). 이미지 ≤10MB, PDF ≤25MB | intake G-3 |
| A-006 | 위장 알림 카피 풀 = 한국어 50개 이상. 텍스트/사진/파일 분기 | intake G-3 |
| A-007 | 뉴스 API 는 공식 확정 전까지 GNews/MediaStack/NewsAPI.org 후보 중 무료 tier 선정 | PROJECT.md |

### 제약

- 개인 사용 (친구 6명, 3쌍). 공식 서비스 아님
- E2E 암호화는 v1 범위 밖
- 단일 서버 self-host (고가용성 HA 구성 불포함)
- 한국어 단일 언어

### 비-목표 (v1 범위 밖)

- 다국어 지원
- 웹 버전 (RN 단일)
- 그룹 채팅
- E2E 암호화
- 관리자 기능 (admin 계정)
- SSO / 소셜 로그인

---

## 전제 / 우선순위 적용

- 사용자 유형 = 단일(에이전트). brief §3 및 intake §1 기준. DECISIONS.md 의 3종(anonymous/agent/admin) 은 PLAN-001/002 에 적용된 값으로 PLAN-003 brief 가 명시 변경.
- 가정 A-001 ~ A-007 은 intake §가정 레벨. Juno 명시 지시 또는 brief 갱신 시 해당 내용 우선.
- 우선순위: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-PM (Claude Sonnet 4.6) — PLAN-003-DOC-REQ-SPEC_
