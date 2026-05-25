// NewsFeedScreen — DailyNews disguised feed (v3)
//
// 시퀀스 입력 메커니즘 변경 (Hero 카드 제거, 카테고리 strip 활용):
//   1. DailyNews 워드마크 탭 → ARM (8초 타이머, 외관 변화 0)
//      * 단, 우측 프로필 아바타 배경색이 회색(#e5e5ea)으로 미세 변화 —
//        사용자 본인만 인지. 어깨너머 관찰자에겐 "선택된 상태"로 보임.
//   2. ARM 상태에서 카테고리 pill 의 position 5 → 3 → 1 → 7 순서로 탭
//      → unlock_token 발급 (localStorage.dn_unlock = "1")
//   3. 카드 탭은 일반 기사 열기 (시퀀스 영향 0)
//
// 위장 강화:
//   - 카테고리 pill 의 position 1~7 이 곧 시퀀스 카드 1~7 을 대체
//   - 외부 관찰자에겐 평범한 카테고리 필터 사용으로 보임
//   - 활성 카테고리 표시 (검정 bg) 는 그대로 작동 → 일반 필터처럼 보임

const { useState, useEffect, useRef, useCallback } = React;

// ─── Mock data ─────────────────────────────────────────────────────────────
// 균일한 카드 그리드 — hero 제거. 모든 카드가 동일 크기.
const ARTICLES = [
  { id: 1, title: '기후 정상회담, 25개국 탄소 감축 합의안에 서명',
    source: '글로벌리포트', time: '32분 전',
    tone: { bg: '#dbe5d3', fg: '#3a4530', label: 'WORLD' } },
  { id: 2, title: '한국은행, 기준금리 동결 결정… 시장 안도 랠리',
    source: '데일리이코노미', time: '1시간 전',
    tone: { bg: '#dde4ec', fg: '#2b3a4a', label: 'ECONOMY' } },
  { id: 3, title: '신형 전기차 배터리, 충전 8분에 주행거리 512km 검증',
    source: '모빌리티투데이', time: '1시간 전',
    tone: { bg: '#d3dde6', fg: '#27384a', label: 'TECH' } },
  { id: 4, title: 'K-드라마 신작, 28개국 OTT 시청률 동시 1위 달성',
    source: '컬처라인', time: '2시간 전',
    tone: { bg: '#e7ddea', fg: '#42304a', label: 'CULTURE' } },
  { id: 5, title: '도시 재생 프로젝트, 폐공장이 복합문화공간으로',
    source: '어반저널', time: '3시간 전',
    tone: { bg: '#ece2d1', fg: '#4a3f28', label: 'URBAN' } },
  { id: 6, title: '프로야구 개막전, 잠실 7만 1천명 최다 관중 신기록',
    source: '스포츠데일리', time: '4시간 전',
    tone: { bg: '#ecdcd6', fg: '#4a2f28', label: 'SPORTS' } },
  { id: 7, title: 'AI 윤리 가이드라인, 국가 단위 표준화 논의 본격화',
    source: '테크와이어', time: '5시간 전',
    tone: { bg: '#d8e0db', fg: '#2c3a33', label: 'TECH' } },
];

// 카테고리 pill — 위치(position)가 시퀀스 키. 위치 5 → 3 → 1 → 7.
// 카테고리 라벨은 위장 — 자연스러운 일반 뉴스 앱 카테고리.
const CATEGORIES = [
  { pos: 1, label: '헤드라인' },
  { pos: 2, label: '정치' },
  { pos: 3, label: '경제' },
  { pos: 4, label: '기술' },
  { pos: 5, label: '문화' },
  { pos: 6, label: '스포츠' },
  { pos: 7, label: '사회' },
];

const TRIGGER_SEQUENCE = [5, 3, 1, 7];   // → 일반 사용자 채팅 모드 unlock
const ADMIN_SEQUENCE   = [7, 1, 3, 5];   // → Admin 콘솔 진입 (역순 패턴)

// ─── Tiny inline icons ─────────────────────────────────────────────────────
const Icon = {
  home: (active) => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <path d="M4 11.5L13 4l9 7.5V22a1 1 0 01-1 1h-5v-6h-6v6H5a1 1 0 01-1-1V11.5z"
        fill={active ? '#007aff' : 'none'}
        stroke={active ? '#007aff' : '#86868b'} strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
  compass: () => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="9" stroke="#86868b" strokeWidth="1.8"/>
      <path d="M16.8 9.2l-2 5.6-5.6 2 2-5.6 5.6-2z" stroke="#86868b" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
  search: () => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="11.5" cy="11.5" r="6.5" stroke="#86868b" strokeWidth="1.8"/>
      <path d="M17 17l4.5 4.5" stroke="#86868b" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  gear: () => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="3.2" stroke="#86868b" strokeWidth="1.8"/>
      <path d="M13 2v3M13 21v3M2 13h3M21 13h3M5.3 5.3l2.1 2.1M18.6 18.6l2.1 2.1M5.3 20.7l2.1-2.1M18.6 7.4l2.1-2.1"
        stroke="#86868b" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  more: () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <circle cx="4" cy="10" r="1.6" fill="#86868b"/>
      <circle cx="10" cy="10" r="1.6" fill="#86868b"/>
      <circle cx="16" cy="10" r="1.6" fill="#86868b"/>
    </svg>
  ),
};

// ─── Editorial image placeholder ───────────────────────────────────────────
function ImagePlaceholder({ tone, height, rounded = 12, label }) {
  const stripes = `repeating-linear-gradient(135deg, ${tone.bg} 0 14px, ${shade(tone.bg, -4)} 14px 28px)`;
  return (
    <div style={{
      width: '100%', height,
      borderRadius: rounded,
      background: stripes,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}/>
  );
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ─── Story card (uniform — hero removed) ────────────────────────────────────
function StoryCard({ article, onTap }) {
  const [pressed, setPressed] = useState(false);
  return (
    <article
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => onTap(article.id)}
      style={{
        background: '#ffffff',
        borderRadius: 14,
        padding: 14,
        display: 'flex', gap: 14, alignItems: 'stretch',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'transform 120ms ease, opacity 120ms ease',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        opacity: pressed ? 0.92 : 1,
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8,
          color: '#86868b', textTransform: 'uppercase', marginBottom: 6,
        }}>
          {article.tone.label}
        </div>
        <h3 style={{
          fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
          fontSize: 16, fontWeight: 600, lineHeight: 1.28, letterSpacing: -0.2,
          color: '#1d1d1f', margin: 0, textWrap: 'pretty',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {article.title}
        </h3>
        <div style={{
          marginTop: 'auto', paddingTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11.5, color: '#86868b',
        }}>
          <span>
            <span style={{ fontWeight: 600, color: '#1d1d1f' }}>{article.source}</span>
            <span style={{ marginLeft: 6 }}>· {article.time}</span>
          </span>
          <Icon.more/>
        </div>
      </div>
      <div style={{ width: 96, flexShrink: 0 }}>
        <ImagePlaceholder tone={article.tone} height={96} rounded={10}/>
      </div>
    </article>
  );
}

// ─── Pull-to-refresh ───────────────────────────────────────────────────────
function PullToRefresh({ children, onRefresh }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const scrollRef = useRef(null);
  const THRESHOLD = 64;

  const onPointerDown = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) startY.current = e.clientY;
  };
  const onPointerMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.clientY - startY.current;
    if (dy > 0) { e.preventDefault?.(); setPull(Math.min(110, dy * 0.55)); }
  };
  const finish = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(56);
      onRefresh?.();
      setTimeout(() => { setRefreshing(false); setPull(0); }, 1400);
    } else { setPull(0); }
  };

  const indicatorOpacity = Math.min(1, pull / THRESHOLD);
  const spinnerRotation = refreshing ? null : (pull / THRESHOLD) * 360;

  return (
    <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finish} onPointerCancel={finish}
      style={{ position: 'relative', height: '100%', overflow: 'hidden', touchAction: 'pan-y' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 1, opacity: indicatorOpacity,
      }}>
        <div style={{
          width: 26, height: 26,
          animation: refreshing ? 'dn-spin 0.9s linear infinite' : 'none',
          transform: refreshing ? 'none' : `rotate(${spinnerRotation || 0}deg)`,
        }}>
          <svg width="26" height="26" viewBox="0 0 26 26">
            <circle cx="13" cy="13" r="10" stroke="#d2d2d7" strokeWidth="2.4" fill="none"/>
            <path d="M13 3a10 10 0 019.4 6.6" stroke="#86868b" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
      </div>
      <div ref={scrollRef} style={{
        height: '100%', overflowY: 'auto', overflowX: 'hidden',
        transform: `translateY(${pull}px)`,
        transition: startY.current == null ? 'transform 260ms cubic-bezier(0.2,0.8,0.2,1)' : 'none',
        WebkitOverflowScrolling: 'touch', paddingBottom: 88,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Bottom tab bar ────────────────────────────────────────────────────────
function TabBar() {
  const tabs = [
    { id: 'home', label: '오늘', Icon: Icon.home, active: true },
    { id: 'browse', label: '둘러보기', Icon: Icon.compass },
    { id: 'search', label: '검색', Icon: Icon.search },
    { id: 'settings', label: '설정', Icon: Icon.gear },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 30, paddingTop: 8,
      background: 'rgba(255,255,255,0.86)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '0.5px solid rgba(60,60,67,0.12)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10,
    }}>
      {tabs.map(({ id, label, Icon: I, active }) => (
        <button key={id} style={{
          background: 'none', border: 'none', padding: '4px 12px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          fontFamily: '-apple-system, system-ui', cursor: 'pointer',
        }}>
          <I active={active}/>
          <span style={{
            fontSize: 10.5, fontWeight: 500,
            color: active ? '#007aff' : '#86868b', letterSpacing: -0.1,
          }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Category strip — doubles as the SEQUENCE INPUT (positions 1-7) ───────
// 위치 5 → 3 → 1 → 7 순으로 탭하면 unlock. 비-ARM 상태에선 일반 필터.
function CategoryStrip({ activeFilterIdx, setActiveFilterIdx, onPillTap }) {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '6px 16px 14px',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {CATEGORIES.map((c, i) => (
        <button
          key={c.pos}
          onClick={() => {
            // visible behavior: switch filter (위장)
            setActiveFilterIdx(i);
            // covert behavior: feed pill position into sequence tracker
            onPillTap?.(c.pos);
          }}
          style={{
            flexShrink: 0,
            padding: '7px 14px',
            borderRadius: 999,
            fontSize: 13, fontWeight: 600,
            letterSpacing: -0.1,
            background: i === activeFilterIdx ? '#1d1d1f' : 'rgba(0,0,0,0.05)',
            color: i === activeFilterIdx ? '#fff' : '#1d1d1f',
            border: 'none', cursor: 'pointer',
            fontFamily: '-apple-system, system-ui',
            transition: 'background 120ms',
          }}
        >{c.label}</button>
      ))}
    </div>
  );
}

// ─── Wordmark header — tap to ARM ──────────────────────────────────────────
// ARM/disarm 시 외관 변화 0. 단, 우측 아바타 배경색만 미세 변화 (사용자 인지용).
function FeedHeader({ armed, onArmToggle }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ padding: '6px 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onClick={onArmToggle}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
            color: '#ff3b30', textTransform: 'uppercase',
          }}>
            2026년 5월 20일 · 수요일
          </div>
          <div style={{
            fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
            fontSize: 34, fontWeight: 800, letterSpacing: -1.1,
            color: '#1d1d1f', lineHeight: 1, marginTop: 4,
            transform: pressed ? 'scale(0.97)' : 'scale(1)',
            transition: 'transform 120ms ease',
            // ⚠️ 워드마크 자체는 ARM 상태에도 외관 변화 0
          }}>
            DailyNews
          </div>
        </div>

        {/* Profile avatar — ARM 상태일 때만 배경이 #e5e5ea (separator 톤) 로 변경.
            사용자 본인만 인지하는 미세 피드백. 어깨너머엔 "선택된 상태" 처럼 보임. */}
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: armed
            ? 'linear-gradient(135deg, #e5e5ea 0%, #c5c5ca 100%)'
            : 'linear-gradient(135deg, #c7d2dd 0%, #93a4b6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 600,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          transition: 'background 220ms ease',
        }}>JK</div>
      </div>
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────
function NewsFeedScreen() {
  const [armed, setArmed] = useState(false);
  // pillHistory — ARM 세션 중 탭한 카테고리 position 들 (최근 4개만 유지).
  // 채팅 / Admin 시퀀스를 동시에 검증.
  const [pillHistory, setPillHistory] = useState([]);
  const [activeFilterIdx, setActiveFilterIdx] = useState(0); // 헤드라인
  const armTimer = useRef(null);

  // ⚠️  DISGUISE PRINCIPLE — 토스트 / 애니메이션 / 소리 / 진동 ZERO.
  // 외부 단서: ① 아바타 배경색 미세 변경 (ARM 상태), ② unlock 후 자연 swap.

  const armToggle = useCallback(() => {
    setArmed((a) => {
      const next = !a;
      if (next) {
        if (armTimer.current) clearTimeout(armTimer.current);
        armTimer.current = setTimeout(() => {
          setArmed(false);
          setPillHistory([]);
        }, 8000);
      } else {
        if (armTimer.current) clearTimeout(armTimer.current);
        setPillHistory([]);
      }
      return next;
    });
  }, []);

  // 카테고리 pill 탭 = 시퀀스 트래커 input (ARM 시에만 진행)
  // 채팅·Admin 두 시퀀스를 동시 확인. 매치되는 쪽으로 라우팅.
  const handlePillTap = useCallback((pillPos) => {
    if (!armed) return; // disarm 상태 → 일반 필터로만 작동
    setPillHistory((h) => {
      const next = [...h, pillPos].slice(-4); // 최근 4개만 유지
      if (next.length === 4) {
        const seq = next.join(',');
        if (seq === TRIGGER_SEQUENCE.join(',')) {
          try { localStorage.setItem('dn_unlock', '1'); } catch {}
          setArmed(false);
          if (armTimer.current) clearTimeout(armTimer.current);
          return [];
        }
        if (seq === ADMIN_SEQUENCE.join(',')) {
          try { localStorage.setItem('dn_admin', '1'); } catch {}
          setArmed(false);
          if (armTimer.current) clearTimeout(armTimer.current);
          // 프로토타입용 — RN 에서는 navigation.navigate('Admin')
          setTimeout(() => {
            try { window.location.href = 'AdminScreen.html'; } catch {}
          }, 200);
          return [];
        }
      }
      return next;
    });
  }, [armed]);

  // 카드 탭 = 일반 기사 열기 (시퀀스 영향 0)
  const handleCardTap = useCallback((articleId) => {
    // RN 에서는 navigation.navigate('ArticleDetail', { id: articleId })
  }, []);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f5f5f7',
      position: 'relative',
      fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
      color: '#1d1d1f', WebkitFontSmoothing: 'antialiased',
    }}>
      <PullToRefresh onRefresh={() => { /* would re-fetch feed */ }}>
        <FeedHeader armed={armed} onArmToggle={armToggle}/>
        <CategoryStrip
          activeFilterIdx={activeFilterIdx}
          setActiveFilterIdx={setActiveFilterIdx}
          onPillTap={handlePillTap}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          {/* Section eyebrow */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: -2, marginBottom: -2,
          }}>
            <div style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: 1.4,
              color: '#86868b', textTransform: 'uppercase',
            }}>오늘의 헤드라인</div>
            <button style={{
              background: 'none', border: 'none',
              fontSize: 13, fontWeight: 500, color: '#007aff', cursor: 'pointer',
              fontFamily: 'inherit',
            }}>전체 보기</button>
          </div>

          {/* Uniform card grid — 모든 카드 동일 크기 */}
          {ARTICLES.map((a) => (
            <StoryCard key={a.id} article={a} onTap={handleCardTap}/>
          ))}

          <div style={{
            textAlign: 'center', fontSize: 11, color: '#86868b',
            padding: '20px 0 6px', letterSpacing: 0.2,
          }}>마지막 업데이트 · 오후 2:14</div>
        </div>
      </PullToRefresh>

      <TabBar/>
      <SequencePeek pillHistory={pillHistory} armed={armed}/>
    </div>
  );
}

// ─── Dev-only progress indicator (D 키 토글) ───────────────────────────────
function SequencePeek({ pillHistory, armed }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'd' || e.key === 'D') setShow((s) => !s); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!show) return null;

  const posToLabel = Object.fromEntries(CATEGORIES.map(c => [c.pos, c.label]));
  const histStr = pillHistory.map(p => `${p}·${posToLabel[p]}`).join(' → ') || '—';

  const prefixMatches = (target) =>
    pillHistory.every((p, i) => target[i] === p);
  const chatPossible  = prefixMatches(TRIGGER_SEQUENCE);
  const adminPossible = prefixMatches(ADMIN_SEQUENCE);

  return (
    <div style={{
      position: 'absolute', top: 8, right: 8, zIndex: 99,
      background: 'rgba(0,0,0,0.78)', color: '#fff',
      padding: '8px 12px', borderRadius: 10,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 11, letterSpacing: 0.3, lineHeight: 1.5,
      minWidth: 200,
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700 }}>
        <span style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: 999,
          background: armed ? '#34c759' : '#ff453a',
        }}/>
        {armed ? 'ARMED' : 'disarmed'}
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{pillHistory.length}/4</span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.85, fontSize: 10 }}>
        seq: {histStr}
      </div>
      {armed ? (
        <div style={{ marginTop: 4, fontSize: 10 }}>
          <div style={{ color: chatPossible  ? '#34c759' : '#666' }}>chat  → 5·3·1·7</div>
          <div style={{ color: adminPossible ? '#ff9500' : '#666' }}>admin → 7·1·3·5</div>
        </div>
      ) : (
        <div style={{ marginTop: 2, opacity: 0.7, fontSize: 10 }}>
          tap DailyNews wordmark to arm
        </div>
      )}
    </div>
  );
}

window.NewsFeedScreen = NewsFeedScreen;
