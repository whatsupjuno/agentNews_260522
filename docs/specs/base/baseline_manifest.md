# Baseline Manifest v1.0 — agentNews

---

## 1. 버전 / 상태

| 항목 | 값 |
|---|---|
| 버전 | v1.0 |
| 상태 | Phase 1 기준선 확정 |
| 기준 문서 | requirements_spec.md v1.0 (PLAN-003-DOC-REQ-SPEC) |
| 작성일 | 2026-05-19 |

---

## 2. 포함 범위

requirements_spec.md §2-1 와 동일한 기능 집합 (G1 게이트 기준).

### 2-1. 도메인 목록

| 도메인 | 포함 기능 | 연관 REQ |
|---|---|---|
| **auth** | 이메일+비밀번호 회원가입, 로그인, JWT 세션(access+refresh), 로그아웃 | REQ-001, REQ-002, REQ-003 |
| **news** | 외부 뉴스 API 연동, 뉴스 피드 표시 (캐시 TTL 10분) | REQ-004, REQ-005 |
| **secret_unlock** | 비밀 시퀀스 등록·변경·검증, unlock_token 발급, 분실 복구(이메일 reset), 위장 유지(시퀀스 실패 시) | REQ-006, REQ-007, REQ-008, REQ-009 |
| **pairing** | 에이전트 ID 검색, 페어링 요청·수락·거부·해제, 1 active pair 제약 | REQ-010, REQ-011, REQ-012, REQ-013, REQ-014 |
| **chat** | 1:1 실시간 채팅(WebSocket), 메시지 전송·수신, 메시지 AES-256-GCM 서버측 암호화, 메시지 보존 90일·자동 삭제 | REQ-015, REQ-016, REQ-017 |
| **attachment** | 사진·파일 업로드(MinIO), presigned URL 다운로드, 매직바이트 검증, 90일 보존·삭제 | REQ-018, REQ-019, REQ-020 |
| **notification_disguise** | FCM 위장 푸시 알림("📰 새 뉴스"), 첨부 종류별 카피 분기, 0~60초 jitter | REQ-021, REQ-022 |
| **disguise_ux** | 백그라운드 5초 후 뉴스 피드 강제 복귀, 앱 재시작 시 채팅 화면 표시 안 함 | REQ-023, REQ-024 |
| **audit** | audit_logs append-only 기록, DB 트리거 불변성, 1년 보존 | REQ-025 |

### 2-2. 포함 기능 요약 (14건)

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

---

## 3. 제외 범위 (v1 밖)

| 항목 | 사유 |
|---|---|
| 다국어 지원 | 한국어 단일 언어. 친구 6명 대상 |
| 웹 버전 | React Native 단일. 위장 강화 (URL bar 없음) |
| 그룹 채팅 | 1:1 전용. 그룹 채팅은 위장 복잡도 상승 |
| E2E 암호화 | 서버측 단일키(AES-256-GCM) 만 적용. E2E 는 v2 이후 |
| 관리자 기능 (admin 계정) | PLAN-003 brief 명시 제외. 운영은 직접 DB 접근 |
| SSO / 소셜 로그인 | 이메일+비밀번호 단일 인증 |
| 고가용성 (HA) 구성 | 단일 서버 Docker self-host. 6명 규모에서 불필요 |

---

## 4. 의존 외부 시스템

| 시스템 | 역할 | 연동 방식 | 비고 |
|---|---|---|---|
| 뉴스 API (GNews / MediaStack / NewsAPI.org 中 1개 선정) | 뉴스 기사 목록 제공 | REST HTTP GET, API Key 인증 | 무료 tier. 확정 전 후보 3개 유지 (A-007) |
| FCM (Firebase Cloud Messaging) | iOS/Android 위장 푸시 알림 발송 | firebase-admin SDK (백엔드) | iOS APNs 는 FCM 이 자동 중계 |
| MinIO | 첨부파일 오브젝트 스토리지 | S3 호환 REST (@aws-sdk/client-s3) | Docker self-host |

---

## 5. 가정

requirements_spec.md §9 가정과 동일.

| ID | 내용 | 출처 |
|---|---|---|
| A-001 | 비밀 시퀀스 = 에이전트 본인 등록. 노출 순서(top N) 기준. 길이 4~6개 | intake G-1 |
| A-002 | 시퀀스 분실 복구 = 이메일 인증 reset. 페어 유지·히스토리 보존 | intake G-1 |
| A-003 | 백그라운드 5초 이상 시 채팅 자동 종료. 재시작 시 뉴스 피드부터 | intake G-2 |
| A-004 | 채팅 히스토리 90일 보존. 페어 해제 시 양측 즉시 삭제 | intake G-2 |
| A-005 | 첨부 저장소 MinIO (Docker self-host). 이미지 ≤10MB / PDF ≤25MB | intake G-3 |
| A-006 | 위장 알림 카피 풀 한국어 50개 이상. 텍스트/사진/파일 분기 | intake G-3 |
| A-007 | 뉴스 API 무료 tier 선정. GNews / MediaStack / NewsAPI.org 후보 | PROJECT.md |

---

## 6. 변경 이력

| 버전 | 날짜 | 내용 | 작성자 |
|---|---|---|---|
| v1.0 | 2026-05-19 | 최초 작성. PLAN-003 Phase 1 기준선 | WA-PM (Claude Sonnet 4.6) |

---

_작성: WA-PM (Claude Sonnet 4.6) — PLAN-003-DOC-BASELINE_
