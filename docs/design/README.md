# Handoff: DailyNews (codename: agentNews) — MVP

> **읽는 사람에게**: 이 문서는 Claude Code (또는 사람 개발자) 가 단독으로 읽고 구현할 수 있도록 작성되었습니다. 첨부된 HTML 파일은 동작 / 시각 / 인터랙션의 reference 입니다 — 그대로 ship 하는 코드가 아닙니다.

---

## 0. Bundle 구성

```
design_handoff_dailynews_mvp/
├── README.md                       ← 이 문서. 우선 읽기.
├── storyboard.html                 ← 5개 핵심 플로우 (frame-by-frame)
└── designs/
    ├── index.html                  ← 디자인 진입점 (모든 화면 카드)
    ├── NewsFeedScreen.html         ← 메인 피드 (인터랙티브)
    ├── ArticleDetailScreen.html    ← 일반 모드 + 채팅 swap 모드
    ├── PushNotifications.html      ← iOS / Android 알림
    ├── SettingsScreen.html         ← 설정 + (참고용) 시퀀스 모달
    ├── frames/                     ← iOS / Android device chrome
    │   ├── ios-frame.jsx
    │   └── android-frame.jsx
    └── screens/                    ← 화면별 React 컴포넌트 (reference)
        ├── shared.jsx
        ├── news-feed-screen.jsx
        ├── article-detail-screen.jsx
        ├── pairing-search-screen.jsx  ← 참고용 (MVP 범위 외)
        ├── push-notification-preview.jsx
        └── settings-screen.jsx
```

브라우저에서 `designs/index.html` 을 열면 모든 화면이 카드로 정리되어 있습니다. `storyboard.html` 은 사용자 여정 다이어그램.

---

## 1. About the Design Files

**이 번들의 HTML 파일은 디자인 reference 입니다 — 프로토타입이며, production 코드가 아닙니다.**

- 프로토타입은 **vanilla React + Babel standalone + inline styles** 로 작성됨 (브라우저에서 바로 열리도록).
- 목표 코드베이스 (React Native + NativeWind + React Navigation) 에서 이 디자인을 **재현** 해야 함.
- 색상, 타이포, 간격, 인터랙션은 픽셀 단위로 맞춰야 함 (high-fidelity).
- 컴포넌트 구조와 props 는 코드베이스의 기존 패턴 + NativeWind 의 유틸리티 클래스로 표현.

---

## 2. Fidelity

**High-fidelity.** 모든 색상 / 타이포 / 간격은 최종 디자인 값입니다. 추측하지 말고 §6 Design Tokens 에 명시된 정확한 값을 사용.

---

## 3. Overview (앱 컨셉)

**DailyNews** 는 위장된 뉴스 앱입니다. 외부 관찰자에게는 평범한 Apple News / 다음뉴스 풍 뉴스 리더로 보이지만, 특정 시퀀스를 입력하면 1:1 비공개 대화 모드가 열립니다.

**핵심 컨셉:**
1. 사용자가 피드의 **"DailyNews" 워드마크를 탭** → 시퀀스 입력 모드 활성 (ARM, 8초 타이머)
2. ARM 상태에서 **카드 5번 → 3번 → 1번 → 7번** 순서로 탭
3. 4번째 정확한 탭에서 unlock_token 발급 → `ArticleDetailScreen` 안에서 채팅 모드로 conditional swap

**왜 위장 인가:**
이 앱은 "비밀요원 놀이" 컨셉의 친구들 간 SaaS 입니다. 외부 관찰자 (어깨너머 / 분실 / 호기심) 에게는 끝까지 뉴스 앱처럼 보여야 합니다.

---

## 4. Tech Stack (Target)

- **React Native** (bare workflow 권장 — `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler` 사용 자유)
- **NativeWind** (Tailwind 문법) — 디자인 토큰을 `tailwind.config.js` 에 정의
- **React Navigation v6+** (Native Stack)
- **TypeScript** 권장
- **Backend**: 별도 REST API (`POST /auth/register`, `POST /auth/login`, `GET /news/feed`, `POST /sequence/verify`, `GET /messages`, `POST /messages`, `POST /attachments`, `DELETE /users/me`)
- **Push**: FCM (Android) / APNs (iOS) — notification payload only (data 없음)
- **WebSocket**: 메시지 실시간 — `wss://api.dailynews.app/socket`

---

## 5. 위장 강화 규칙 (CRITICAL — 모든 코드에서 강제)

| 규칙 | 외부 노출 표현 | 내부 코드 표현 |
|---|---|---|
| 앱 이름 | "DailyNews" / "오늘의뉴스" | (bundle id: `com.dailynews.app`) |
| 앱 아이콘 | 신문 N 로고 | — |
| 채팅 어휘 | "기사 토론" | `ChatMode` (내부 enum) |
| 채팅 입력 placeholder | "댓글 입력" | — |
| 페어 어휘 | "구독자" | `pair` (DB 컬럼) |
| 시퀀스 어휘 | "콘텐츠 잠금 코드" | `sequence` (DB 컬럼) |
| RN screen name | `ArticleDetailScreen` (채팅도 같은 이름!) | conditional render |
| URL / route | — (RN 에는 URL bar 자체 없음) | — |
| 푸시 alert title | "📰 새 뉴스" | — |
| 푸시 alert body | 위장 헤드라인 한 줄 | — |
| 푸시 data payload | **금지** (notification only) | — |
| App Switcher | 채팅 모드여도 피드처럼 보임 | `onBackground` hook 으로 swap |
| 스크린샷 | Android `FLAG_SECURE`, iOS background blur | — |

**금지 단어 (소스 코드 외 모든 사용자 노출 문자열)**: `chat`, `secret`, `agent`, `message`, `pair`, `채팅`, `비밀`, `메시지`, `에이전트`.

---

## 6. Design Tokens

### Colors
```js
const colors = {
  // Surfaces
  bg:           '#f5f5f7',  // app background
  surface:      '#ffffff',  // cards, modals
  bgInverse:    '#1d1d1f',  // dark surface (e.g. lock screen)

  // Text
  text:         '#1d1d1f',  // primary
  muted:        '#86868b',  // secondary
  inverse:      '#ffffff',  // on dark

  // Brand
  accent:       '#007aff',  // iOS system blue
  red:          '#ff3b30',  // iOS red — date eyebrow, destructive
  green:        '#34c759',  // success — paired status
  orange:       '#ff9500',  // warning
  purple:       '#af52de',  // sub-account icon

  // Chat
  bubbleMe:     '#007aff',  // my message
  bubblePeer:   '#e9e9eb',  // peer message
  bubbleMeFg:   '#ffffff',
  bubblePeerFg: '#1d1d1f',

  // Separators
  separator:    'rgba(60,60,67,0.12)',
};
```

### Typography (SF Pro)
```js
const typography = {
  // SF Pro Display — large titles, headlines
  displayXxl: { family: 'SF Pro Display', size: 34, weight: '800', tracking: -1.1, lineHeight: 1.0 },  // wordmark
  displayXl:  { family: 'SF Pro Display', size: 28, weight: '800', tracking: -0.6, lineHeight: 1.18 }, // article H1
  displayLg:  { family: 'SF Pro Display', size: 22, weight: '700', tracking: -0.4, lineHeight: 1.22 }, // hero card title

  // SF Pro Text — body, UI
  bodyLg:     { family: 'SF Pro Text', size: 17, weight: '400', tracking: -0.4, lineHeight: 1.3 },    // settings row, chat
  body:       { family: 'SF Pro Text', size: 16, weight: '400', tracking: -0.2, lineHeight: 1.5 },    // body paragraphs
  bodySm:     { family: 'SF Pro Text', size: 15, weight: '500', tracking: -0.2, lineHeight: 1.4 },    // captions

  // Eyebrows / labels
  eyebrow:    { family: 'SF Pro Text', size: 11, weight: '700', tracking: 1.4,  textTransform: 'uppercase' },
  caption:    { family: 'SF Pro Text', size: 12, weight: '500', tracking: 0.0 },
  mono:       { family: 'SF Mono', size: 12, weight: '500', tracking: 0.2 },
};
```

### Spacing scale (8pt grid)
```js
const spacing = [4, 8, 12, 16, 20, 24, 32, 48, 64];
```

### Radii
```js
const radius = {
  none:     0,
  sm:       4,
  md:       8,
  card:     12,   // article card, settings group
  cardLg:   14,   // settings card
  modal:    18,   // bottom sheet
  bubble:   22,   // chat bubble corner (4 grouped)
  pill:     999,
};
```

### Shadow
```js
const shadow = {
  card:   '0 1px 3px rgba(0,0,0,0.08)',
  cardLg: '0 1px 3px rgba(0,0,0,0.05), 0 6px 18px rgba(0,0,0,0.04)',
  modal:  '0 12px 36px rgba(0,0,0,0.18)',
  toast:  '0 6px 24px rgba(0,0,0,0.18)',
};
```

---

## 7. MVP 범위 (최종 5 플로우)

| # | 플로우 | 화면 | 상태 |
|---|---|---|---|
| 01 | 위장 진입 | NewsFeedScreen + ArticleDetailScreen | ✅ MVP |
| 02 | 위장 알림 | (시스템) | ✅ MVP |
| 03 | 첨부 전송 | ArticleDetailScreen (chat mode) | ✅ MVP |
| 04 | 회원가입 | LoginScreen + RegisterScreen | ✅ MVP |
| 05 | 프로필 편집 + 데이터 삭제 | SettingsScreen + ProfileEditScreen | ✅ MVP |

**범위 외 (DB 직접 관리):**
- 잠금 코드 변경 — 관리자가 DB 의 `users.sequence_hash` 컬럼에 직접 새 hash 등록
- 페어링 생성 — 관리자가 DB 의 `pairs (user_a, user_b)` 테이블에 행 직접 추가 (1:1 제약)
- 잠금 해제 도움말 (이메일 reset 플로우)

**MVP 에서 잠금 코드 상수:** 모든 사용자가 동일하게 `[5, 3, 1, 7]` 사용 (서버에서 상수로 정의). 향후 사용자별 커스터마이즈 추가 예정.

---

## 8. 화면별 상세 사양

### 8.1 LoginScreen (미인증)

**Layout** — 전체 화면 흰색 배경, 세로 중앙 정렬.

```
┌─────────────────────────────────┐
│        DailyNews                │  ← wordmark (SF Pro Display 32/800)
│   매일의 뉴스를 한 곳에서          │  ← subtitle (13/400, #86868b)
│                                 │
│   ┌─────────────────────────┐   │
│   │ 이메일                   │   │  ← input
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │ 비밀번호                 │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │       로그인             │   │  ← CTA (#007aff bg)
│   └─────────────────────────┘   │
│                                 │
│  비밀번호 찾기   회원가입         │  ← links
└─────────────────────────────────┘
```

**Components:**
- **Input**: bg `#f5f5f7`, radius 8, padding `12 16`, font `bodyLg`, placeholder color `muted`.
- **Login CTA**: bg `accent` `#007aff`, fg `#fff`, radius 12, padding `14`, font `bodyLg 600`.
- **회원가입 link**: outlined pill — 1px border `#ff3b30`, color `#ff3b30`, radius 999, padding `4 12`.

**API:** `POST /auth/login` → `{ token, user }`. 실패 시 input 아래 빨간 에러 텍스트 (12/500, `#ff3b30`).

---

### 8.2 RegisterScreen

**Layout** — LoginScreen 과 동일한 vertical stack. 필드 4개 (이메일 / ID / 비밀번호 / 비밀번호 확인) + CTA "계정 만들기" + 약관 동의 텍스트.

**Validation rules:**
- 이메일: RFC 5322
- ID: 4-20자 영문/숫자/_, 중복 검증
- 비밀번호: 8자 이상

**API:** `POST /auth/register` → `{ token, user }`. 성공 시 자동 로그인되어 `NewsFeedScreen` 으로 navigate (replace, 뒤로 못 감).

---

### 8.3 NewsFeedScreen — 가장 중요

**Layout** (390 × 844 기준):

```
┌─ Status bar ──────────────────────┐
│  ╭─────────────────╮              │
│  │ 5월 20일 · 수요일  │              │  ← date eyebrow (red, 11/700, +1.4)
│  │ DailyNews        │  [Avatar]   │  ← wordmark (34/800) — TAPPABLE!
│  ╰─────────────────╯              │
│  [헤드라인][정치][경제][기술][문화]…  │  ← category strip (h-scroll pills)
│  ╭─────────────────────────────╮  │
│  │  [HERO IMAGE 16:9, r:16]    │  │  ← article #1 (hero)
│  │  WORLD · 헤드라인              │  │
│  │  기후 정상회담, 25개국 탄소…   │  │
│  │  서울에서 열린 제3차…          │  │
│  │  글로벌리포트 · 32분 전 ⌃ ⋯   │  │
│  ╰─────────────────────────────╯  │
│  많이 읽은 기사       전체 보기    │
│  ╭───────────────────╮ ╭──╮       │
│  │ ECONOMY            │ │■│       │  ← article #2
│  │ 한국은행 금리 동결…   │ │ │       │
│  │ 데일리이코노미 · 1h  │ ╰──╯       │
│  ╰───────────────────╯              │
│  … 카드 #3~#7 (#1 hero + 6 thumb) │
│  마지막 업데이트 · 오후 2:14       │
├───────────────────────────────────┤
│  [홈][둘러보기][검색][설정]         │  ← tab bar (blur)
└───────────────────────────────────┘
```

**핵심 인터랙션 — 시퀀스 트래커:**

```ts
type FeedState = {
  armed: boolean;        // 시퀀스 입력 대기 중인가
  progress: 0 | 1 | 2 | 3 | 4;  // 시퀀스 진행
  armTimeout?: NodeJS.Timeout;
};

const TRIGGER_SEQUENCE = [5, 3, 1, 7] as const;
const ARM_TIMEOUT_MS = 8000;

function onTapWordmark() {
  if (state.armed) {
    // 이미 ARM 상태 — disarm
    clearTimeout(state.armTimeout);
    setState({ armed: false, progress: 0 });
  } else {
    // ARM 활성화
    const t = setTimeout(() => {
      setState({ armed: false, progress: 0 });
    }, ARM_TIMEOUT_MS);
    setState({ armed: true, progress: 0, armTimeout: t });
    // ⚠️ 외관 변화 없음 — 토스트 / 애니 / 소리 / 진동 전부 금지
  }
}

function onTapArticle(articleId: number, position: number) {
  if (!state.armed) {
    // 위장 기본 동작 — 일반 기사 열기
    navigation.navigate('ArticleDetailScreen', { articleId, mode: 'normal' });
    return;
  }
  const expected = TRIGGER_SEQUENCE[state.progress];
  if (position === expected) {
    const nextProgress = state.progress + 1;
    if (nextProgress === 4) {
      // 시퀀스 완성
      clearTimeout(state.armTimeout);
      setState({ armed: false, progress: 0 });
      issueUnlockToken();  // 서버 API call → 응답 받아서 store
      // ⚠️ 토스트 금지 — 유일한 외부 신호는
      //    ArticleDetailScreen 의 conditional swap 그 자체
      navigation.navigate('ArticleDetailScreen', { articleId, mode: 'chat' });
    } else {
      setState({ progress: nextProgress });
    }
  } else {
    // 잘못된 카드 — reset (단, #5면 새 시작)
    setState({ progress: position === 5 ? 1 : 0 });
  }
}
```

**중요 — 시각적 피드백 규칙 (DISGUISE PRINCIPLE — STRICT):**
- 워드마크 탭 (ARM 온/오프) 시 외관 **변화 0** — 토스트/애니/소리/진동 **전부 금지**
- 카드 탭 (정답/오답/reset) 시 시각적 피드백 **없음**
- auto-disarm (8초 timeout) 도 silent
- 유일한 외부 신호 = 4번째 탭 완료 시 `ArticleDetailScreen` 으로 자연스러운 이동 → 그 화면이 채팅 모드로 swap 되어 있는 것
- `showToast` 같은 함수 절대 호출 금지

**Pull-to-refresh:**
- 임계값 64px, dampening factor 0.55
- 스피너 회전 = pull / threshold * 360deg
- 임계값 도달 시 native spinner 모드 (0.9s 회전)
- API: `GET /news/feed` (실제 데이터 갱신)

**카드 데이터 모델:**
```ts
type Article = {
  id: number;          // 1..N (시퀀스 추적용 position 으로도 사용)
  category: string;    // 'WORLD' | 'ECONOMY' | 'TECH' | ...
  categoryKr: string;  // '세계' | '경제' | '기술' | ...
  title: string;
  summary?: string;    // hero card 만
  source: string;
  publishedAt: string;
  imageUrl?: string;
  isHero: boolean;     // 첫 카드만 true
};
```

**디자인 detail:**
- Hero card: 이미지 height 210, radius 16, eyebrow `#007aff`, title 22/700/-0.4
- Story card: padding 14, gap 14, thumbnail 96×96 r10, title 16/600 (3-line clamp)
- Category pill: padding `7 14`, radius 999, active = `#1d1d1f` bg / `#fff` fg
- Tab bar: bottom safe-area + 22px padding, blur backdrop, active = `#007aff`

---

### 8.4 ArticleDetailScreen — Normal + Chat 두 모드 통합

**같은 RN screen 안에서 conditional swap.** 헤더 chrome 은 두 모드에서 동일 — 외부 관찰자가 "기사 보고 있구나" 로 인식.

**Header (always):**
```
┌──────────────────────────────────────┐
│ ‹ 피드      [Title]      [⌃] [⌫]    │  ← back · title · bookmark · share
└──────────────────────────────────────┘
```
- Title in normal mode: "기사" + subtitle (출처명)
- Title in chat mode: "기사 토론" + subtitle ("N개의 댓글 · 비공개")
- Header bg: `rgba(255,255,255,0.86)` + `backdrop-blur(24px)`, border-bottom 0.5px `#3c3c43_20%`

**Body — Normal mode (`mode = 'normal'`):**
- Full-bleed hero (260px, no top radius)
- Category eyebrow (`#007aff`, 11/700/+1.6)
- Title (`displayXl` 28/800)
- Deck (16/400, line-height 1.5)
- Byline row (avatar 36px + 출처+기자 + "+ 팔로우" pill)
- Body paragraphs (16/400, line-height 1.62, first letter drop-cap 46px)
- "원문 보기" 회색 버튼 (radius 12, padding `14 16`)
- "관련 기사" 섹션 (제목 + 64×64 썸네일)

**Body — Chat mode (`mode = 'chat'`):**
- Pinned context card 상단: 토론 중인 기사 (40×40 썸네일 + "토론 중인 기사" eyebrow + 기사 제목 1-line)
- Day separator: "오늘 오전 11:48" (12/400 muted center)
- Message bubbles:
  - Me: bg `#007aff`, fg `#fff`, align right
  - Peer: bg `#e9e9eb`, fg `#1d1d1f`, align left
  - Radius 22 + 4 corner pinch (1분 내 같은 sender 면 grouping — `groupedAbove ? 4 : 22` for facing corner)
  - Max width 74%, padding `8 14 9`, font `bodyLg`
  - Attachment: image 200×200 cap inside bubble (padding 4, image radius 18)
- Bottom sticky input bar:
  - 첨부 (+) 아이콘 — 36×36 r-pill `#f1f1f3`
  - 카메라 아이콘 — 동일
  - Text input — bg `#fff`, border 0.5px, radius 22, padding `7 12`
  - Placeholder: "댓글 입력"
  - 입력 시 mic 아이콘 → send 아이콘 (32×32 round `#007aff`)
  - Bottom padding 30px (home indicator)

**Mode detection:**
```ts
function ArticleDetailScreen({ route }) {
  const { articleId, mode: forceMode } = route.params;
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (forceMode === 'chat') { setUnlocked(true); return; }
    if (forceMode === 'normal') { setUnlocked(false); return; }
    // fallback — check stored unlock_token
    const token = await secureStorage.get('unlock_token');
    setUnlocked(!!token && !isExpired(token));
  }, [forceMode]);

  return (
    <Screen>
      <Header
        title={unlocked ? '기사 토론' : '기사'}
        subtitle={unlocked ? `${messages.length}개의 댓글 · 비공개` : article.source}
      />
      {unlocked ? <ChatBody articleId={articleId}/> : <ArticleBody article={article}/>}
    </Screen>
  );
}
```

**unlock_token lifetime:** 60분. 만료 시 자동 disarm + 다음 진입은 다시 시퀀스 필요.

**API:**
- `GET /articles/:id` → article body
- `GET /chat/:roomId/messages?before=:cursor` → messages (페어 1:1 채팅방)
- `POST /chat/:roomId/messages` → `{ text?: string, attachmentId?: string }`
- WebSocket `wss://api…/chat/:roomId` → 실시간 새 메시지 push

---

### 8.5 첨부 전송 (Flow 03)

**Trigger:** 채팅 모드 입력바의 + 아이콘 탭.

**Flow:**
1. RN bridge → OS sharesheet (`react-native-image-picker` / `react-native-document-picker`)
2. 사용자가 사진 또는 PDF 선택
3. 클라이언트 → `POST /attachments` (multipart, header `X-Status: UPLOADING`) → 즉시 응답 `{ id, status: 'UPLOADING' }`
4. 서버 백그라운드: MIME + 매직바이트 + 확장자 3중 검증 → `status: AVAILABLE` 로 업데이트
5. 입력바 위에 압축 미리보기 chip (썸네일 60×60 + 업로드 % + 취소 X)
6. 사용자가 + 메시지 본문 함께 전송: `POST /chat/:roomId/messages` `{ text, attachmentId }`
7. 페어에게 위장 푸시 ("📰 새 뉴스 — …")

**미리보기 규칙:**
- 이미지: 200×200 cap, radius 12, OS 기본 뷰어로 탭 시 open
- PDF: 아이콘 + 파일명 + 크기 표시, 탭 시 OS 기본 뷰어

---

### 8.6 PushNotifications

**Server side** — Cloud Messaging:
```json
{
  "to": "<device_token>",
  "notification": {
    "title": "📰 새 뉴스",
    "body": "AI 모델 공개 — 안전성 논쟁 가열",
    "sound": "default"
  }
  // ⚠️ data 필드 절대 사용 금지!
}
```

위장 헤드라인 풀: 서버에서 10-20개의 "가짜 뉴스 헤드라인" 풀 보유 → 메시지 도착 시 random 선택.

**App switcher 위장:**
- iOS: `applicationDidEnterBackground` → 화면을 PNG 캡쳐 후 흰 피드 placeholder 로 즉시 swap
- Android: `FLAG_SECURE` (전체 앱 적용 — 채팅 모드 전환 시 toggle on, 일반 모드 시 off)

**Notification tap:**
- Cold start: `messaging().getInitialNotification()` → `NewsFeedScreen` 으로 진입 (NOT chat)
- Warm start: `messaging().onNotificationOpenedApp()` → 동일

채팅 자동 진입 절대 금지. 사용자가 별도로 ARM + 시퀀스 입력해야 함.

---

### 8.7 SettingsScreen

**Layout — iOS grouped list 풍:**

```
┌ 설정 ────────────────────────────┐
│                                  │
│  ┌──────────────────────────────┐│
│  │ [Avatar] 전준규              ││  ← profile card
│  │          @junkyu_2026        ││
│  │          ● 구독자 1명 연결됨   ││  ← status pill
│  └──────────────────────────────┘│
│                                  │
│  계정                             │  ← group header
│  ┌──────────────────────────────┐│
│  │ ✎ 프로필 편집           ›    ││
│  │ 🔒 비밀번호 변경         ›    ││
│  │ 📩 이메일 변경  ju***   ›    ││
│  └──────────────────────────────┘│
│                                  │
│  앱                               │
│  ┌──────────────────────────────┐│
│  │ 🔔 알림           켜짐  ›    ││
│  │ ◑ 다크 모드      시스템 ›    ││
│  │ ⓘ 버전 정보  2.4.1 (312)    ││
│  └──────────────────────────────┘│
│                                  │
│  ┌──────────────────────────────┐│
│  │       로그아웃 (red)          ││
│  └──────────────────────────────┘│
│                                  │
│       DailyNews · 2.4.1 (312)    │
└──────────────────────────────────┘
```

**Row spec:**
- min-height 44 (iOS hit target)
- icon 30×30 r7 색상 채움 + 우상단 chevron `›` (8×14 #c5c5c7)
- separator 0.5px `#3c3c43_12%`, left inset 56px (아이콘 너비 + gap)
- font `bodyLg` 17/400/-0.4

**아이콘 배경 컬러 매핑 (iOS 시스템 스타일):**
- 프로필 편집: `#8e8e93` (gray)
- 비밀번호 변경: `#5856d6` (purple)
- 이메일 변경: `#34c759` (green)
- 알림: `#ff453a` (red)
- 다크 모드: `#5ac8fa` (cyan)
- 버전 정보: `#8e8e93` (gray)

**참고:** 구 디자인에는 "콘텐츠 잠금 코드", "구독자 관리" 행이 있었지만 **MVP 에선 제거**. DB 관리이므로 UI 없음. `designs/SettingsScreen.html` 에는 참고용으로 남아있으나 production 에선 빼야 함.

---

### 8.8 ProfileEditScreen + 데이터 삭제 (Flow 05)

**Layout:**

```
┌ 프로필 편집 ──────────────────────┐
│         ┌───┐                    │
│         │AV │ ⊕  ← camera badge  │
│         └───┘                    │
│                                  │
│  ┌──────────────────────────────┐│
│  │ 닉네임                        ││
│  │ 전준규                  ✎    ││  ← editable
│  ├──────────────────────────────┤│
│  │ 사용자 ID                     ││
│  │ @junkyu_2026 (고정)          ││  ← read-only (muted)
│  ├──────────────────────────────┤│
│  │ 상태 메시지                   ││
│  │ 없음                    ›    ││
│  └──────────────────────────────┘│
│                                  │
│  ┌──────────────────────────────┐│
│  │      데이터 삭제 (red)        ││  ← destructive
│  └──────────────────────────────┘│
│                                  │
│   계정 + 메시지 + 첨부 모든       │
│   데이터가 영구 삭제됩니다         │
└──────────────────────────────────┘
```

**데이터 삭제 버튼 동작:**
1. 탭 → 확인 모달 (full-screen, 빨간 헤더)
2. 모달 내용:
   - 큰 빨간 ! 아이콘
   - 헤드라인: "모든 데이터를 삭제하시겠어요?"
   - 경고 리스트 (left-aligned):
     - • 계정 영구 삭제
     - • 모든 메시지 + 첨부 삭제
     - • 페어 연결 자동 해제
     - • 복구 불가능
   - "삭제" 단어 입력 input
   - CTA: "데이터 삭제" (빨간 bg, 입력 단어 일치 시에만 활성)
   - 취소 link
3. 확인 → `DELETE /users/me` → 서버 cascade (계정 / 메시지 / 첨부 / 페어 행 삭제)
4. 응답 받으면 `secureStorage.clear()` + RN navigation `reset` 으로 `LoginScreen` 진입

**API:**
- `PATCH /users/me` `{ nickname?, statusMessage? }` → 즉시 적용 + 페어에게 WebSocket broadcast
- `POST /users/avatar` (multipart) → URL 반환
- `DELETE /users/me` → 204, response body 없음

---

## 9. Navigation Stack

```
RootStack (Native Stack)
├── (unauthenticated)
│   ├── LoginScreen
│   └── RegisterScreen
└── (authenticated)
    ├── NewsFeedScreen          ← initial route
    ├── ArticleDetailScreen     ← params: { articleId, mode?: 'normal' | 'chat' }
    ├── SettingsScreen
    └── ProfileEditScreen
```

`mode` 파라미터를 통해 같은 screen 이 두 가지 형태로 렌더됨. Deep linking 자체가 없으므로 외부에서 mode='chat' 으로 진입 불가.

**Auth 가드:**
```ts
function RootNavigator() {
  const { isAuthenticated } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen name="NewsFeedScreen" component={NewsFeedScreen}/>
          <Stack.Screen name="ArticleDetailScreen" component={ArticleDetailScreen}/>
          <Stack.Screen name="SettingsScreen" component={SettingsScreen}/>
          <Stack.Screen name="ProfileEditScreen" component={ProfileEditScreen}/>
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="LoginScreen" component={LoginScreen}/>
          <Stack.Screen name="RegisterScreen" component={RegisterScreen}/>
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
```

---

## 10. 데이터 / API 계약 요약

| Endpoint | Method | 용도 |
|---|---|---|
| `/auth/register` | POST | 회원가입 |
| `/auth/login` | POST | 로그인 |
| `/auth/logout` | POST | 토큰 폐기 |
| `/users/me` | GET / PATCH / DELETE | 프로필 조회 / 갱신 / 삭제 |
| `/users/avatar` | POST | 아바타 업로드 |
| `/news/feed` | GET | 뉴스 피드 (paged) |
| `/articles/:id` | GET | 기사 본문 |
| `/sequence/verify` | POST | `{ sequence: [5,3,1,7] }` → `{ unlock_token, expires_at }` |
| `/chat/:roomId/messages` | GET / POST | 메시지 목록 / 전송 |
| `/attachments` | POST | 첨부 업로드 (multipart) |
| `/attachments/:id` | GET | 다운로드 URL 발급 |

WebSocket:
- `wss://api.dailynews.app/chat/:roomId?token=:jwt`
- Server → client: `{ type: 'message', payload: Message }`, `{ type: 'pair_event', event: 'updated' | 'disconnected' }`

---

## 11. 구현 순서 권장

1. **Setup** — RN bare workflow + NativeWind + Tailwind config (디자인 토큰 §6 등록)
2. **Auth** — `LoginScreen` / `RegisterScreen` + auth context + JWT secureStorage
3. **NewsFeedScreen** — 정적 mock 데이터로 우선 렌더 → API 연결 → pull-to-refresh → tab bar
4. **워드마크 ARM + 시퀀스 트래커** — `useFeedSequence()` 커스텀 훅 분리
5. **ArticleDetailScreen — normal** — 기사 본문 + drop-cap
6. **ArticleDetailScreen — chat mode** — 메시지 리스트 + 버블 grouping + 입력바
7. **WebSocket + 메시지 실시간** — `useChat(roomId)` 훅
8. **첨부 picker + 업로드** — `react-native-image-picker` + multipart
9. **Push 알림** — `@react-native-firebase/messaging` + 위장 헤드라인 표시만
10. **App switcher 위장** — `AppState` listener + iOS blur / Android FLAG_SECURE
11. **SettingsScreen + ProfileEditScreen + 데이터 삭제** — 마지막
12. **위장 검수** — 전체 문자열 grep 으로 금지 단어 0 확인

---

## 12. 검수 체크리스트

- [ ] 외부 노출 문자열에 `chat / secret / agent / message / 채팅 / 비밀 / 메시지` 0 회
- [ ] 알림 payload 에 `data` 필드 없음 (notification only)
- [ ] 채팅 모드 헤더 타이틀 = "기사 토론"
- [ ] 채팅 입력 placeholder = "댓글 입력"
- [ ] RN screen name 에 `Chat` 단어 없음
- [ ] App switcher / 백그라운드 캡쳐 시 채팅 → 피드 swap
- [ ] Android FLAG_SECURE (채팅 모드 토글)
- [ ] iOS background blur (채팅 모드 토글)
- [ ] unlock_token 만료 시 자동 disarm
- [ ] ARM 8초 timeout
- [ ] 잘못된 카드 탭 시 reset (단, #5 면 progress=1 으로 재시작)
- [ ] 시퀀스 완성 시 시각 피드백 0 (위장)
- [ ] 워드마크 탭 시 외관 변화 0 — 토스트/애니/소리/진동 모두 금지
- [ ] 카드 오탭 reset 시 시각 피드백 0
- [ ] auto-disarm (8초) silent

---

## 13. 참고 자료 (HTML 파일)

| 파일 | 무엇을 확인 |
|---|---|
| `storyboard.html` | 사용자 여정 — Flow 01~05 frame-by-frame |
| `designs/NewsFeedScreen.html` | 워드마크 탭 동작, 카드 레이아웃, pull-to-refresh — 실제로 작동함, 브라우저에서 테스트 |
| `designs/ArticleDetailScreen.html` | 두 모드 비교 — 헤더 동일 + 본문만 swap |
| `designs/PushNotifications.html` | 알림 카드 정확한 색상 / 레이아웃 |
| `designs/SettingsScreen.html` | 리스트 행 스타일 + 모달 sheet 스타일 (모달은 MVP 범위 외 — 참고만) |
| `designs/screens/news-feed-screen.jsx` | 시퀀스 트래커 로직 — JS 코드를 TypeScript + RN 으로 옮기면 됨 |
| `designs/screens/article-detail-screen.jsx` | 버블 grouping, corner pinch, 입력바 |
| `designs/screens/shared.jsx` | 색상 / 폰트 / 아이콘 상수 |

브라우저에서 `designs/NewsFeedScreen.html` 을 열고 **`D` 키** 를 누르면 시퀀스 트래커 디버그 패널이 보입니다. 워드마크 탭 → ARM → 카드 #5 #3 #1 #7 순으로 탭해서 동작 확인 가능.

---

## 14. 마지막 알림

이 앱의 핵심 가치는 **"외부에서 봤을 때 평범한 뉴스 앱"** 입니다. 모든 PR 리뷰 시 다음을 자문:

> "어깨너머로 누가 이 화면을 봤을 때, 이게 뉴스 앱이 아닌 다른 것임을 추측할 만한 단서가 단 한 개라도 있는가?"

답이 "있다" 면 그 단서를 제거하고 머지하세요.

— *agentNews / DailyNews MVP Handoff · 2026.05.23*
