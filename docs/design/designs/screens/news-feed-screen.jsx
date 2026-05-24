// NewsFeedScreen — DailyNews disguised feed
// Tap sequence (5 → 3 → 1 → 7 on the 1·3·5·7 hero+tile positions) persists to
// localStorage as `dn_unlock` so future ArticleDetailScreen can swap to chat mode.
// No visible disguise affordances anywhere.

const { useState, useEffect, useRef, useCallback } = React;

// ─── Mock data ─────────────────────────────────────────────────────────────
const ARTICLES = [
  {
    id: 1,
    kind: 'hero',
    eyebrow: '세계',
    title: '기후 정상회담, 25개국 탄소 감축 합의안에 서명',
    summary: '서울에서 열린 제3차 글로벌 기후 정상회담에서 25개 참가국이 2030년까지 탄소 배출량 45% 감축에 합의했다.',
    source: '글로벌리포트',
    time: '32분 전',
    tone: { bg: '#dbe5d3', fg: '#3a4530', label: 'WORLD' },
  },
  {
    id: 2,
    eyebrow: '경제',
    title: '한국은행, 기준금리 동결 결정… 시장 즉시 안도 랠리',
    source: '데일리이코노미',
    time: '1시간 전',
    tone: { bg: '#dde4ec', fg: '#2b3a4a', label: 'ECONOMY' },
  },
  {
    id: 3,
    eyebrow: '기술',
    title: '신형 전기차 배터리, 충전 8분에 주행거리 512km 검증',
    source: '모빌리티투데이',
    time: '1시간 전',
    tone: { bg: '#d3dde6', fg: '#27384a', label: 'TECH' },
  },
  {
    id: 4,
    eyebrow: '문화',
    title: 'K-드라마 신작, 28개국 OTT 시청률 동시 1위 달성',
    source: '컬처라인',
    time: '2시간 전',
    tone: { bg: '#e7ddea', fg: '#42304a', label: 'CULTURE' },
  },
  {
    id: 5,
    eyebrow: '사회',
    title: '도시 재생 프로젝트, 폐공장이 복합문화공간으로',
    source: '어반저널',
    time: '3시간 전',
    tone: { bg: '#ece2d1', fg: '#4a3f28', label: 'URBAN' },
  },
  {
    id: 6,
    eyebrow: '스포츠',
    title: '프로야구 개막전, 잠실 7만 1천명… 최다 관중 신기록',
    source: '스포츠데일리',
    time: '4시간 전',
    tone: { bg: '#ecdcd6', fg: '#4a2f28', label: 'SPORTS' },
  },
  {
    id: 7,
    eyebrow: '기술',
    title: 'AI 윤리 가이드라인, 국가 단위 표준화 논의 본격화',
    source: '테크와이어',
    time: '5시간 전',
    tone: { bg: '#d8e0db', fg: '#2c3a33', label: 'TECH' },
  },
];

const TRIGGER_SEQUENCE = [5, 3, 1, 7];

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
  bookmark: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 3h10v14l-5-3-5 3V3z" stroke="#86868b" strokeWidth="1.6" strokeLinejoin="round"/>
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
// Subtle striped tone block + small monospace marker. Per project guidance:
// never hand-draw editorial illustrations, use placeholders.
function ImagePlaceholder({ tone, height, rounded = 12, label }) {
  const stripes = `repeating-linear-gradient(135deg, ${tone.bg} 0 14px, ${shade(tone.bg, -4)} 14px 28px)`;
  return (
    <div style={{
      width: '100%', height,
      borderRadius: rounded,
      background: stripes,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        position: 'absolute', left: 12, bottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        color: tone.fg, opacity: 0.55,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: 10, letterSpacing: 0.6,
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: 1,
          background: tone.fg, opacity: 0.7,
        }}/>
        {label}
      </div>
    </div>
  );
}

function shade(hex, amt) {
  // shift each channel by amt (negative = darker)
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ─── Cards ─────────────────────────────────────────────────────────────────
function HeroCard({ article, onTap }) {
  const [pressed, setPressed] = useState(false);
  return (
    <article
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => onTap(article.id)}
      style={{
        background: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 6px 18px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'transform 120ms ease, opacity 120ms ease',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        opacity: pressed ? 0.92 : 1,
      }}
    >
      <ImagePlaceholder tone={article.tone} height={210} rounded={0} label="HERO PHOTO 16:9" />
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.8,
          color: '#007aff', textTransform: 'uppercase', marginBottom: 8,
        }}>
          {article.tone.label} · 헤드라인
        </div>
        <h2 style={{
          fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
          fontSize: 22, fontWeight: 700, lineHeight: 1.22, letterSpacing: -0.4,
          color: '#1d1d1f', margin: 0, textWrap: 'pretty',
        }}>
          {article.title}
        </h2>
        <p style={{
          fontSize: 14.5, lineHeight: 1.45, color: '#3a3a3c',
          margin: '8px 0 12px', textWrap: 'pretty',
        }}>
          {article.summary}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: '#86868b',
        }}>
          <span style={{ fontWeight: 600, letterSpacing: 0.04, color: '#1d1d1f' }}>
            {article.source}
            <span style={{ color: '#86868b', fontWeight: 400, marginLeft: 8 }}>
              · {article.time}
            </span>
          </span>
          <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Icon.bookmark/>
            <Icon.more/>
          </span>
        </div>
      </div>
    </article>
  );
}

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
        <ImagePlaceholder tone={article.tone} height={96} rounded={10} label="" />
      </div>
    </article>
  );
}

// ─── Pull-to-refresh container ─────────────────────────────────────────────
function PullToRefresh({ children, onRefresh }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const scrollRef = useRef(null);

  const THRESHOLD = 64;

  const onPointerDown = (e) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      startY.current = e.clientY;
    }
  };
  const onPointerMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.clientY - startY.current;
    if (dy > 0) {
      e.preventDefault?.();
      // dampened pull
      setPull(Math.min(110, dy * 0.55));
    }
  };
  const finish = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(56);
      onRefresh?.();
      setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 1400);
    } else {
      setPull(0);
    }
  };

  const indicatorOpacity = Math.min(1, pull / THRESHOLD);
  const spinnerRotation = refreshing ? null : (pull / THRESHOLD) * 360;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      style={{ position: 'relative', height: '100%', overflow: 'hidden', touchAction: 'pan-y' }}
    >
      {/* Pull indicator */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 1,
        opacity: indicatorOpacity,
      }}>
        <div style={{
          width: 26, height: 26,
          animation: refreshing ? 'dn-spin 0.9s linear infinite' : 'none',
          transform: refreshing ? 'none' : `rotate(${spinnerRotation || 0}deg)`,
        }}>
          <svg width="26" height="26" viewBox="0 0 26 26">
            <circle cx="13" cy="13" r="10" stroke="#d2d2d7" strokeWidth="2.4" fill="none"/>
            <path d="M13 3a10 10 0 019.4 6.6"
              stroke="#86868b" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
      </div>
      <div
        ref={scrollRef}
        style={{
          height: '100%',
          overflowY: 'auto', overflowX: 'hidden',
          transform: `translateY(${pull}px)`,
          transition: startY.current == null ? 'transform 260ms cubic-bezier(0.2,0.8,0.2,1)' : 'none',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 88, // tab bar
        }}
      >
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
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      zIndex: 10,
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
            color: active ? '#007aff' : '#86868b',
            letterSpacing: -0.1,
          }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Category chip strip ───────────────────────────────────────────────────
function CategoryStrip() {
  const cats = ['헤드라인', '정치', '경제', '기술', '문화', '스포츠', '국제'];
  const [active, setActive] = useState(0);
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '6px 16px 14px',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {cats.map((c, i) => (
        <button key={c} onClick={() => setActive(i)} style={{
          flexShrink: 0,
          padding: '7px 14px',
          borderRadius: 999,
          fontSize: 13, fontWeight: 600,
          letterSpacing: -0.1,
          background: i === active ? '#1d1d1f' : 'rgba(0,0,0,0.05)',
          color: i === active ? '#fff' : '#1d1d1f',
          border: 'none', cursor: 'pointer',
          fontFamily: '-apple-system, system-ui',
        }}>{c}</button>
      ))}
    </div>
  );
}

// ─── Wordmark header ───────────────────────────────────────────────────────
// Tapping the DailyNews wordmark ARMS the sequence tracker. When not armed,
// tapping a card opens the article (disguise default). The wordmark tap is
// itself the secret — visually it just looks like a logo tap (subtle press).
function FeedHeader({ armed, onArmToggle }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ padding: '6px 16px 12px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
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
            // armed state shows a barely-perceptible tonal shift — only the user
            // who knows the secret would notice. To external observers it looks
            // identical to the unarmed wordmark.
            color: armed ? '#0f1010' : '#1d1d1f',
          }}>
            DailyNews
          </div>
        </div>
        {/* avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: 'linear-gradient(135deg, #c7d2dd 0%, #93a4b6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 600,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>JK</div>
      </div>
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────
function NewsFeedScreen() {
  // ARMED gate — sequence tracking only runs after the user taps the
  // DailyNews wordmark. Disarmed by default. Auto-disarms after 8 seconds of
  // inactivity (so an idle armed state never persists into someone else's hands).
  const [armed, setArmed] = useState(false);
  const [progress, setProgress] = useState(0); // index into TRIGGER_SEQUENCE
  const armTimer = useRef(null);

  // ⚠️  DISGUISE PRINCIPLE — wordmark tap, ARM state, correct sequence taps,
  // wrong-tap resets, and auto-disarm must produce ZERO visible UI feedback.
  // The only externally visible event is the conditional swap into chat mode
  // (Flow 01, Frame 8) — that swap IS the feedback, no toast.

  const armToggle = useCallback(() => {
    setArmed((a) => {
      const next = !a;
      if (next) {
        // schedule auto-disarm — silent
        if (armTimer.current) clearTimeout(armTimer.current);
        armTimer.current = setTimeout(() => {
          setArmed(false);
          setProgress(0);
        }, 8000);
      } else {
        if (armTimer.current) clearTimeout(armTimer.current);
        setProgress(0);
      }
      return next;
    });
  }, []);

  // Persist unlock state for the future ArticleDetailScreen swap.
  useEffect(() => {
    if (progress >= TRIGGER_SEQUENCE.length) {
      try { localStorage.setItem('dn_unlock', '1'); } catch {}
      // No visible feedback here — the conditional swap into chat mode
      // (driven by dn_unlock) is the only signal.
      setArmed(false);
      if (armTimer.current) clearTimeout(armTimer.current);
    }
  }, [progress]);

  const handleTap = useCallback((articleId) => {
    if (!armed) {
      // Disarmed — would navigate to ArticleDetailScreen (normal mode).
      // No prototype toast: keep behavior identical to production.
      return;
    }
    // Armed — capture into the sequence
    setProgress((p) => {
      const expected = TRIGGER_SEQUENCE[p];
      if (articleId === expected) {
        return p + 1;
      }
      // wrong tap — reset, but allow the just-tapped article to start a new sequence
      if (articleId === TRIGGER_SEQUENCE[0]) return 1;
      return 0;
    });
  }, [armed]);

  const hero = ARTICLES[0];
  const rest = ARTICLES.slice(1);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#f5f5f7',
      position: 'relative',
      fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif',
      color: '#1d1d1f',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <PullToRefresh onRefresh={() => { /* would re-fetch feed */ }}>
        <FeedHeader armed={armed} onArmToggle={armToggle}/>
        <CategoryStrip/>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          <HeroCard article={hero} onTap={handleTap}/>

          {/* Section eyebrow */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 6, marginBottom: -2,
          }}>
            <div style={{
              fontSize: 11.5, fontWeight: 700, letterSpacing: 1.4,
              color: '#86868b', textTransform: 'uppercase',
            }}>
              많이 읽은 기사
            </div>
            <button style={{
              background: 'none', border: 'none',
              fontSize: 13, fontWeight: 500, color: '#007aff', cursor: 'pointer',
              fontFamily: 'inherit',
            }}>전체 보기</button>
          </div>

          {rest.map((a) => (
            <StoryCard key={a.id} article={a} onTap={handleTap}/>
          ))}

          <div style={{
            textAlign: 'center', fontSize: 11, color: '#86868b',
            padding: '20px 0 6px', letterSpacing: 0.2,
          }}>
            마지막 업데이트 · 오후 2:14
          </div>
        </div>
      </PullToRefresh>

      <TabBar/>

      {/* Debug-only sequence indicator — hidden by default to preserve disguise.
          Press D on keyboard to peek. */}
      <SequencePeek progress={progress} armed={armed}/>
    </div>
  );
}

// Dev-only progress indicator hidden behind keyboard shortcut "D"
function SequencePeek({ progress, armed }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'd' || e.key === 'D') setShow((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!show) return null;
  return (
    <div style={{
      position: 'absolute', top: 8, right: 8, zIndex: 99,
      background: 'rgba(0,0,0,0.75)', color: '#fff',
      padding: '6px 10px', borderRadius: 8,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 11, letterSpacing: 0.4,
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: 999,
          background: armed ? '#34c759' : '#ff453a',
        }}/>
        {armed ? 'ARMED' : 'disarmed'}
      </div>
      <div style={{ marginTop: 4 }}>seq {progress}/{TRIGGER_SEQUENCE.length}</div>
      <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>
        {armed ? `next: tap article #${TRIGGER_SEQUENCE[progress] ?? '—'}` : 'tap DailyNews to arm'}
      </div>
    </div>
  );
}

window.NewsFeedScreen = NewsFeedScreen;
