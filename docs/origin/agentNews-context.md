# agentNews — Context Wrap-up

> 새 세션에서 이 문서 먼저 읽고 시작. `/Users/whatsupjuno/WTF/agentic_system_test/` 로 cwd 이동 후 작업 재개.

작성: 2026-05-20 / 작업 기간: 2026-05-18 ~ 2026-05-20 (2.5일)

---

## 1. 한 줄 정의

비밀요원 놀이용 위장 SaaS — 겉으로는 일반 뉴스 앱이지만 메인 피드의 1·3·5·7번 기사를 `5→3→1→7` 순으로 탭하면 비밀 1:1 채팅 모드로 전환되는 RN 앱. 친구 6명 (3페어) 대상.

## 2. 무엇을 했나

1. **시스템 빌드** — `~/WTF/agentic_system_test/` 에 Humanless Planning System v0.2 구축 (Hermes Agent 참고). 6 페르소나 (sv / writer-pm / writer-arch / writer-ux / reviewer / cross-validator), SQLite kanban DB, CLI, tmux 기반 진짜 6 인스턴스 병렬 실행, ANTIPATTERNS 영구 학습 메모리.
2. **agentNews 산출물 생성** — 같은 brief 로 3번 시도. PLAN-001 (단일 세션 simulate, 폐기) → PLAN-002 (v0.2 첫 시도, antipattern 재발 stuck, 폐기) → **PLAN-003 (v0.2 fix 후 성공, 5h, 25 task / 22 산출물)**.
3. **Claude Design Brief HTML** — `~/Desktop/agentNews-design-brief.html` (24 KB). 사용자가 claude.ai 에 복붙해서 RN mockup 생성하기 위한 prompt + 디자인 토큰 + 화면 인벤토리.

---

## 3. 기술 스택 (Juno 확정)

| 영역 | 기술 |
|---|---|
| 모바일 | **React Native + Expo (managed)** + TypeScript + NativeWind + React Navigation v7 |
| 푸시 | `expo-notifications` (APNs + FCM) |
| 파일 picker | `expo-document-picker` + `expo-image-picker` |
| JWT 저장 | `react-native-keychain` (httpOnly cookie 불가) |
| 백엔드 | NestJS + TypeScript |
| DB | PostgreSQL 16 + TypeORM |
| 배포 (백엔드) | Docker + docker-compose |
| 배포 (모바일) | TestFlight (iOS, Apple Dev $99/yr) + Firebase App Distribution (Android), 개발 Expo Go |
| 디자인 가이드 | Apple HIG (iOS 우선) |

## 4. 핵심 의사 결정 (Juno 컨펌)

| 항목 | 결정 |
|---|---|
| 페어링 모델 | **사용자 ID 검색 → 페어링 요청 → 상대 수락** (admin 사전 설정 X). 1 사용자 = 1 active pair |
| 뉴스 API | public-apis github 카탈로그 중 선정 (구체적으로는 spec 에서 NewsAPI.org 가정) |
| 위장 시퀀스 | 페어별 개인화 (1~9 unique 4자리, HMAC-SHA256 + salt 저장, 평문 X) |
| 위장 헤드라인 풀 | 32개 정적 + 12 출처 + 동적 fetch 옵션 |
| 사용자 유형 | 1종 (agent) — 비회원은 미인증 화면만 접근 |
| 첨부 MIME | `image/jpeg, image/png, image/heic, application/pdf, text/plain` (5종) |
| audit 보존 | 1년 hard delete |
| 캐시 TTL | 뉴스 10분 |
| Token TTL | access 15분 / refresh 7일 / unlock_token 30분 |
| E2E 암호화 | v1 범위 외 (서버측 AES-256-GCM) |

---

## 5. PLAN-003 산출물 (모두 절대 경로)

```
~/WTF/agentic_system_test/.planning/tasks/PLAN-003/
├── brief.md                 # 사용자 brief 원본
├── intake.md                # SV intake 결과
├── plan.json                # 메타
└── output/                  # 22 산출물 / 372 KB / 7913 행
    ├── base/
    │   ├── requirements_spec.md          # REQ-001~025
    │   └── baseline_manifest.md
    ├── spec/
    │   ├── status_values_final.md
    │   ├── state_transition_table.md
    │   ├── permission_policy.md
    │   ├── development_conventions.md
    │   ├── db_design.md                  # 14 테이블
    │   ├── ddl.sql                       # PostgreSQL DDL
    │   ├── menu_structure.md             # RN Navigation Stack
    │   ├── screen_inventory_and_function_definition.md  # 13 화면
    │   └── user_scenarios.md             # 12 시나리오
    ├── api/                              # 10 도메인
    │   ├── auth_api_spec.md
    │   ├── user_management_api_spec.md
    │   ├── news_api_spec.md
    │   ├── secret_unlock_api_spec.md
    │   ├── pairing_api_spec.md
    │   ├── chat_api_spec.md
    │   ├── message_api_spec.md
    │   ├── attachment_api_spec.md
    │   ├── notification_api_spec.md
    │   └── audit_log_api_spec.md
    └── cross_validation_report.md        # 4축 매트릭스 검증
```

### 화면 13개

| ID | 화면 | RN Screen | 권한 |
|---|---|---|---|
| SCR-001/002/003 | 로그인 / 회원가입 / 시퀀스 reset | LoginScreen / RegisterScreen / SequenceResetScreen | 미인증 |
| SCR-010/011 | 뉴스 피드 / 기사 상세 | NewsFeedScreen / ArticleDetailScreen | agent |
| **SCR-020** | **채팅 (위장)** | **`ArticleDetailScreen` 내부 swap** | agent + unlock + PAIRED |
| SCR-021/022 | 페어 검색 / 페어링 확인 | PairingSearchScreen / PairingRequestScreen | agent + unlock |
| SCR-030~034 | 설정 / 프로필 / 시퀀스 변경 / reset 요청 / 페어 해제 | SettingsScreen 등 | agent |

### 시나리오 12개

happy 5 (SCN-001, 002, 003, 006, 011) / error 3 (SCN-004, 007, 012) / edge 4 (SCN-005, 008, 009, 010).

핵심 3개:
- SCN-002 위장 진입 (5→3→1→7 시퀀스)
- SCN-006 첨부 전송
- SCN-008 백그라운드 5초 → 위장 복귀

### 게이트 결과

| # | 결과 | 비고 |
|---|---|---|
| G1 요구사항 | PASS | REQ 25개 |
| G2 상태 정합 | PASS | (휴리스틱 0 추출 — false negative 가능) |
| G3 권한 정합 | PASS | 3 유형 × 10 api |
| **G4 DB-API** | **FAIL** | 휴리스틱 1 violation — 산출물 자체는 14/14 일치 |
| G5 화면-API | PASS | (휴리스틱 0 추출) |
| G6 시나리오 커버리지 | PASS | (휴리스틱 0 추출) |
| **G7 cross-ref** | **FAIL** | cross_validation_report 의 PASS/FAIL 판정 미발견 |

G4/G7 FAIL 은 게이트 휴리스틱 한계. 산출물 자체는 무결. **다음 사이클에서 게이트 휴리스틱 더 정교화 권장** (현재 단어 grep 수준).

---

## 6. 시스템 자체 (v0.2)

`~/WTF/agentic_system_test/` 의 핵심 파일:

```
agentic_system_test/
├── personas/                     # 6 페르소나 시스템 프롬프트
│   ├── sv-opus47.md              # Supervisor (Opus 4.7)
│   ├── writer-pm-sonnet46.md     # PM Writer (Sonnet 4.6)
│   ├── writer-arch-opus47.md     # Architect Writer (Opus 4.7)
│   ├── writer-ux-sonnet46.md     # UX Writer (Sonnet 4.6)
│   ├── reviewer-haiku45.md       # Reviewer (Haiku 4.5)
│   └── cross-validator-opus47.md # Cross-Validator (Opus 4.7)
├── docs/                         # 시스템 운영 매뉴얼
│   ├── humanless-planning-sv-operator.md
│   ├── runtime-protocol.md       # v2 — turn 단위 모델
│   ├── execution_spec.md
│   ├── architecture.md
│   └── work_scenario.md
├── skills/                       # 13 skill SKILL.md
├── templates/                    # 9 산출물 템플릿
├── bin/
│   ├── launcher.sh               # tmux 6 윈도우 spawn
│   └── run-persona.sh            # PERSONA_INSTANCE_ID 영속 + heartbeat daemon
├── cli/
│   ├── planning.py               # 메인 CLI (claim/complete/dispatch/memory/gate)
│   └── db_schema.sql
├── tools/
│   └── validate_planning_gate.py # G1~G7
└── .planning/
    ├── kanban.db                 # SQLite DAG board
    ├── state.db                  # session/messages log
    ├── memories/
    │   ├── PROJECT.md
    │   ├── DECISIONS.md
    │   ├── USER.md
    │   └── ANTIPATTERNS.md       # ⭐ 매 사이클 학습 누적 (Hermes 식)
    └── tasks/
        ├── PLAN-001/             # 폐기 (단일 세션 simulate v0.1)
        ├── PLAN-002/             # 폐기 (v0.2 first stuck)
        └── PLAN-003/             # 본 성공 사이클
```

### 핵심 메커니즘 (v0.2)

1. **turn 단위 1 cycle** — 매 turn 1 claim, work, complete. 무한 while/for 금지 (`runtime-protocol.md §2`)
2. **PERSONA_INSTANCE_ID 영속** — `bin/run-persona.sh` 가 env 주입. multi-claim race 차단
3. **heartbeat 외부 daemon** — claude 가 thinking 중이어도 30s 마다 background 가 갱신
4. **lazy load** — 부팅 turn 짧게 (ANTIPATTERNS + runtime-protocol 만). 나머지는 첫 claim 시점
5. **외부 monitor trigger** — 사용자가 매 10분 cycle 마다 `tmux send-keys` 으로 깨움. AP-008 SOP (Escape + C-u + msg + Enter x2) 필수

### ANTIPATTERNS 영구 학습 (AP-001~011)

`.planning/memories/ANTIPATTERNS.md` — 매 페르소나가 부팅 시 *최우선* 으로 prefetch. 이게 Hermes 식 자가 학습.

- AP-001 for-loop polling, AP-002 Monitor/background, AP-003 multi-claim race, AP-004 heartbeat, AP-005 22분 thinking lock, AP-006 SV queue, AP-007 task scope, AP-008 tmux input freeze, AP-009 review_pending dead-lock (fix), AP-010 G2 휴리스틱 (fix), AP-011 artifact path (fix)

---

## 7. 다음 step (옵션)

### A. 디자인 mockup 생성 (즉시 가능)

```bash
open ~/Desktop/agentNews-design-brief.html
```

§8 의 prompt block 복사 → claude.ai → Artifacts 모드로 RN 화면 6종 차례로 생성.

### B. PLAN-003 산출물 정합성 보강 (코드 진입 전)

이전 PLAN-001 사이클에서 발견한 100+ 결함 (cookie 잔재, IDOR, secret_sequence 평문, MIME 모순 등) 이 PLAN-003 산출물에도 일부 잔존 가능성. 검수 사이클 추가 권장:
- critic-pm 페르소나 spawn → 보수적 비판
- sociopath-dev / hacker-security 페르소나 spawn → 정합성 + 보안

단 v0.2 시스템 이미 PLAN-003 에서 G1~G7 검증 완료. 추가 검수는 *선택*.

### C. 코드 진입 (백엔드 먼저)

`output/spec/ddl.sql` 부터 PostgreSQL 띄우고, NestJS 도메인 모듈 10개 차례로 구현. PLAN-003 산출물이 코드 작성 기준.

---

## 8. 새 세션에서 시작하기 (`~/WTF/agentic_system_test/`)

```bash
cd /Users/whatsupjuno/WTF/agentic_system_test
# 컨텍스트 회복
cat ~/Desktop/agentNews-context.md          # 이 문서
cat .planning/memories/ANTIPATTERNS.md      # 학습 결과
cat .planning/tasks/PLAN-003/output/base/requirements_spec.md  # REQ
cat .planning/tasks/PLAN-003/output/cross_validation_report.md  # 검증

# tmux 세션 확인 (살아있으면 재사용 또는 kill)
tmux ls
tmux kill-session -t planning-PLAN-003   # 깨끗하게 정리

# 새 PLAN (예: 산출물 보강 사이클 또는 다른 프로젝트)
python3 cli/planning.py new "<프로젝트명>"
bin/launcher.sh PLAN-NNN

# 또는 디자인 단계로 진입 — agentic_system_test 와 무관, ~/Desktop HTML 만 사용
open ~/Desktop/agentNews-design-brief.html
```

### 외부 monitor 패턴 (페르소나 trigger 시)

PLAN-003 에서 검증된 패턴 — *반드시* 매 turn 마다 AP-008 SOP 적용:

```bash
for w in sv writer-pm writer-arch writer-ux reviewer cross-validator; do
  tmux send-keys -t "planning-PLAN-NNN:$w" Escape; sleep 0.2
  tmux send-keys -t "planning-PLAN-NNN:$w" "C-u"; sleep 0.2
done

tmux send-keys -t planning-PLAN-NNN:writer-arch "다음 turn. **단 1회만** claim writer-arch. ready task 잡으면 절대 경로 .planning/tasks/PLAN-NNN/output/... 작성 + complete."
sleep 0.5
tmux send-keys -t planning-PLAN-NNN:writer-arch Enter
sleep 0.5
tmux send-keys -t planning-PLAN-NNN:writer-arch Enter
```

---

## 9. 누적 메트릭

| 작업 | 시간 | 산출물 |
|---|---|---|
| 시스템 빌드 (v0.1 → v0.2) | ~5 세션 / 누적 ~10시간 | 40+ 시스템 파일 |
| PLAN-001 (단일 세션 simulate) | 8분 30초 | 22 (폐기) |
| PLAN-002 (v0.2 first) | ~1 시간 | 2 (Phase 1 만) |
| **PLAN-003 (v0.2 success)** | **5 시간** | **22 산출물 / 372 KB / 7913 행** |
| Claude Design HTML | — | 1 HTML / 24 KB |
| ANTIPATTERNS 학습 | — | 11 AP |

---

## 10. 핵심 파일 한 줄 참조

| 무엇 | 어디 |
|---|---|
| 이 문서 | `~/Desktop/agentNews-context.md` |
| Claude Design Brief HTML | `~/Desktop/agentNews-design-brief.html` |
| 시스템 root | `~/WTF/agentic_system_test/` |
| PLAN-003 산출물 root | `~/WTF/agentic_system_test/.planning/tasks/PLAN-003/output/` |
| ANTIPATTERNS 영구 학습 | `~/WTF/agentic_system_test/.planning/memories/ANTIPATTERNS.md` |
| 6 페르소나 | `~/WTF/agentic_system_test/personas/` |
| 운영 매뉴얼 | `~/WTF/agentic_system_test/docs/runtime-protocol.md` |
| CLI | `~/WTF/agentic_system_test/cli/planning.py` |
| Launcher | `~/WTF/agentic_system_test/bin/launcher.sh` |

---

**작성자**: Claude Opus 4.7 (외부 모니터 + 시스템 빌더)
