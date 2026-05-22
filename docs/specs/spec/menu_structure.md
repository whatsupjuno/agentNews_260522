# agentNews 메뉴 구조 v1.0

---

## 1. 문서 목적

agentNews v1 의 React Navigation 기반 화면 계층과 사용자 유형별 접근 권한을 정의한다.
screen_inventory_and_function_definition.md 의 모든 화면 라우트·접근 권한은 본 문서와 1:1 정합해야 한다.

PLAN-003 은 단일 사용자 유형 (에이전트, `agent`) 만 존재한다. 비로그인 화면은 미인증 접근 전용 별도 섹션으로 분리.

---

## 2. 내비게이션 스택 구조 (React Navigation)

```
RootNavigator
├── AuthStack (비로그인)               ← 미인증 사용자 전용
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── SequenceResetScreen            ← 이메일 딥링크 진입
└── MainStack (에이전트 로그인 후)
    ├── BottomTabNavigator
    │   ├── NewsFeedTab
    │   │   ├── NewsFeedScreen         ← 앱 시작점 (항상)
    │   │   └── ArticleDetailScreen
    │   └── SettingsTab
    │       ├── SettingsScreen
    │       ├── ProfileEditScreen
    │       ├── SequenceChangeScreen
    │       ├── SequenceResetRequestScreen
    │       └── PairDisconnectScreen
    └── ChatModal (unlock_token 유효 시 full-screen modal push)
        ├── ChatScreen                 ← ArticleDetailScreen conditional swap 진입
        ├── PairingSearchScreen
        └── PairingRequestScreen
```

> ChatScreen 은 ArticleDetailScreen 내부 conditional swap 으로 렌더링 (DECISIONS.md v1.1).
> 탭바에 "채팅" 탭 없음 — 탭 레이블 노출 자체가 위장 파괴.

---

## 3. 사용자 유형별 메뉴 트리

### 3-1. 비로그인 (미인증)

```
LoginScreen              ← 미인증 시 앱 진입점
├── RegisterScreen        ← "회원가입" 버튼 → 전환
└── SequenceResetScreen   ← 이메일 reset 링크 딥링크 탭 진입
```

접근 가능 화면: LoginScreen / RegisterScreen / SequenceResetScreen 만.
그 외 화면 접근 시 → AuthStack(LoginScreen) 으로 강제 리디렉션.

---

### 3-2. 에이전트 (agent, 로그인 후)

```
BottomTabNavigator
│
├── [탭 1] 뉴스 (NewsFeedTab)
│   NewsFeedScreen
│   └── ArticleDetailScreen              ← 기사 카드 탭 시 push
│       └── [시퀀스 unlock 성공 시]
│           ChatModal (full-screen, 탭바 숨김)
│           ├── ChatScreen               ← 1:1 채팅 메인
│           ├── PairingSearchScreen      ← 활성 페어 없을 때만 표시
│           └── PairingRequestScreen     ← 페어링 요청·수락·거부 확인
│
└── [탭 2] 설정 (SettingsTab)
    SettingsScreen
    ├── ProfileEditScreen
    ├── SequenceChangeScreen             ← 현재 시퀀스 재인증 후 변경
    ├── SequenceResetRequestScreen       ← REGISTERED 상태에서만 노출
    └── PairDisconnectScreen             ← PAIRED 상태에서만 노출
```

ChatModal 은 탭바 위에 full-screen 으로 렌더링. unlock_token 만료 또는 REVOKED 시 자동 닫힘 → NewsFeedScreen 복귀 (REQ-023, REQ-024).

---

## 4. 메뉴 항목 표

| 메뉴 ID | 라벨 | Screen Name (React Navigation) | 접근 권한 | 상위 메뉴 | 비고 |
|---|---|---|---|---|---|
| MENU-001 | 로그인 | LoginScreen | 미인증 | - | AuthStack 루트 |
| MENU-002 | 회원가입 | RegisterScreen | 미인증 | MENU-001 | |
| MENU-003 | 시퀀스 reset | SequenceResetScreen | 미인증 (딥링크) | MENU-001 | 이메일 reset 링크 탭 진입. 30분 유효 |
| MENU-010 | 뉴스 피드 | NewsFeedScreen | agent | - (탭 루트) | 앱 최초 화면·백그라운드 복귀 시 항상 표시 |
| MENU-011 | 기사 상세 | ArticleDetailScreen | agent | MENU-010 | 시퀀스 입력 UI 포함. 실패 시 정상 기사 상세 표시 (위장) |
| MENU-020 | 채팅 | ChatScreen | agent + unlock_token 유효 + PAIRED | MENU-011 (conditional swap) | 탭바 숨김. unlock 만료 시 자동 닫힘 |
| MENU-021 | 페어 검색 | PairingSearchScreen | agent + unlock_token 유효 | MENU-020 | 활성 페어 없을 때만 노출 (PAIRED 시 진입 불가) |
| MENU-022 | 페어링 확인 | PairingRequestScreen | agent + unlock_token 유효 | MENU-020 | 요청 발송·수락·거부 공통 화면 |
| MENU-030 | 설정 | SettingsScreen | agent | - (탭 루트) | |
| MENU-031 | 프로필 편집 | ProfileEditScreen | agent | MENU-030 | |
| MENU-032 | 시퀀스 변경 | SequenceChangeScreen | agent | MENU-030 | 현재 시퀀스 재인증 필요 |
| MENU-033 | 시퀀스 reset 요청 | SequenceResetRequestScreen | agent | MENU-030 | REGISTERED 상태에서만 표시 |
| MENU-034 | 페어 해제 확인 | PairDisconnectScreen | agent | MENU-030 | PAIRED 상태에서만 노출. 해제 시 양측 메시지·첨부 즉시 삭제 |

---

## 5. 비로그인 화면 별도 섹션

| Screen Name | 진입 경로 | 설명 |
|---|---|---|
| LoginScreen | 앱 시작 / 미인증 리디렉션 | 이메일+비밀번호 로그인. 탭바 없음 |
| RegisterScreen | LoginScreen → "회원가입" 버튼 | 이메일+비밀번호 계정 생성 |
| SequenceResetScreen | 이메일 reset 링크 딥링크 | 30분 유효. 완료 후 LoginScreen 이동 |

AuthStack 화면은 탭바 없음. 로그인 성공 → RootNavigator 가 MainStack 으로 교체.

---

## 6. 모바일 · PC 차이

v1 = RN 모바일 단일. 웹·PC 버전 없음 (비-목표).
iOS 우선 (Apple HIG). Android 동일 화면 구조, 플랫폼별 네이티브 컴포넌트 차이만 존재.

---

## 체크리스트

- [x] 모든 사용자 유형 (permission_policy §3) 의 트리 명시 — 에이전트 1종 + 비로그인 분리
- [x] 각 메뉴에 Screen Name (RN bare → URL 없음, Screen name 이 route)
- [x] 권한이 permission_policy 와 일치 (unlock_token 조건, PAIRED 조건 모두 반영)
- [x] 메뉴 ID `MENU-NNN` 형식
- [x] 비로그인 화면 별도 섹션 (§5)

---

## 전제 / 우선순위 적용

- **단일 사용자 유형**: PLAN-003 기준 에이전트 1종. admin·anonymous 화면 없음 (permission_policy.md §3, requirements_spec.md §4).
- **탭바 구성**: 뉴스피드·설정 2탭만. "채팅" 탭 없음 — 탭 레이블 자체가 위장 파괴.
- **ChatScreen 위치**: DECISIONS.md v1.1 — ArticleDetailScreen 내부 conditional swap. ChatModal 스택은 별도 내비게이터지만 탭 진입점 없음.
- **Screen Name = route**: RN bare workflow 은 URL bar 없음. route 컬럼은 React Navigation Screen name 기준 (DECISIONS.md v1.1).
- **우선순위**: Juno 지시 > brief > intake > 매뉴얼 > skill > 메모리

---

_작성: WA-UX (Claude Sonnet 4.6) — PLAN-003-DOC-MENU-STRUCTURE_
