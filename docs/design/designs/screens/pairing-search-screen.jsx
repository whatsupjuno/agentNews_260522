// PairingSearchScreen — 사용자 ID 검색 → 페어링 요청
// Disguised vocabulary: "구독자 추가 / 추가" instead of "pair / connect".
// Header label exposed externally: "구독자 추가".

const { useState, useMemo } = React;

const PAIR_USERS = [
  { id: 'jiwon_k',   name: '이지원', tagline: '독자 · 서울',     status: 'available' },
  { id: 'minho.lee', name: '이민호', tagline: '독자 · 부산',     status: 'requested' },
  { id: 'sara_yang', name: '양사라', tagline: '독자 · 인천',     status: 'paired' },
  { id: 'taeho',     name: '김태호', tagline: '독자 · 대전',     status: 'available' },
  { id: 'euna_choi', name: '최은아', tagline: '독자 · 광주',     status: 'available' },
  { id: 'jh_park',   name: '박재현', tagline: '독자 · 수원',     status: 'declined' },
  { id: 'soyeon_a',  name: '안소연', tagline: '독자 · 제주',     status: 'available' },
];

const AVATAR_TONES = [
  ['#c9d6e3', '#27384a'],
  ['#dccfd6', '#42304a'],
  ['#cfddd1', '#2c3a33'],
  ['#dccec6', '#4a2f28'],
  ['#d9d2c2', '#4a3f28'],
  ['#cad6d6', '#2c4040'],
  ['#d4cdda', '#373045'],
];

function PairAvatar({ name, idx, size = 44 }) {
  const [bg, fg] = AVATAR_TONES[idx % AVATAR_TONES.length];
  const initial = name.charAt(0);
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: `linear-gradient(135deg, ${bg}, ${dnShade(bg, -16)})`,
      color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: DN_FONT_DISPLAY, fontSize: size * 0.42, fontWeight: 600,
      letterSpacing: -0.5,
      flexShrink: 0,
      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.06)',
    }}>{initial}</div>
  );
}

function StatusPill({ status }) {
  const map = {
    available: { label: '추가',     bg: '#007aff', fg: '#fff', interactive: true },
    requested: { label: '요청됨',   bg: '#f1f1f3', fg: '#86868b', interactive: false },
    paired:    { label: '추가됨',   bg: '#e7f7ec', fg: '#28a745', interactive: false },
    declined:  { label: '다시 요청', bg: '#fff2f1', fg: '#ff453a', interactive: true },
  };
  const s = map[status];
  return (
    <button disabled={!s.interactive} style={{
      background: s.bg, color: s.fg, border: 'none',
      padding: '8px 16px', borderRadius: 999,
      fontFamily: DN_FONT, fontSize: 13, fontWeight: 600,
      letterSpacing: -0.1,
      cursor: s.interactive ? 'pointer' : 'default',
      opacity: s.interactive ? 1 : 0.95,
    }}>{s.label}</button>
  );
}

function PairingSearchScreen() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PAIR_USERS.filter(u =>
      u.id.toLowerCase().includes(q) || u.name.includes(q)
    );
  }, [query]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: DN_COLORS.bg,
      position: 'relative', overflow: 'hidden',
      fontFamily: DN_FONT, color: DN_COLORS.text,
      display: 'flex', flexDirection: 'column',
    }}>
      <DNScreenHeader
        leftLabel="설정"
        title="구독자 추가"
        subtitle="사용자 ID로 검색"
      />

      {/* Search input */}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
          border: '0.5px solid ' + (focused ? DN_COLORS.accent : 'rgba(60,60,67,0.18)'),
          boxShadow: focused ? '0 0 0 3px rgba(0,122,255,0.12)' : 'none',
          transition: 'box-shadow 120ms, border-color 120ms',
        }}>
          {DNIcon.search('#86868b')}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="@사용자ID 또는 이름"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: DN_FONT, fontSize: 15, color: DN_COLORS.text,
              letterSpacing: -0.2, minWidth: 0,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: '#e5e5ea', border: 'none',
              width: 18, height: 18, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0, flexShrink: 0,
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M2 2l6 6M8 2l-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        <div style={{
          fontSize: 11.5, color: DN_COLORS.muted,
          padding: '8px 4px 0', letterSpacing: -0.1,
        }}>
          정확한 ID로 검색해야 결과가 표시됩니다.
        </div>
      </div>

      {/* Results / empty state */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 24px' }}>
        {!query ? (
          <SuggestedSection/>
        ) : filtered.length === 0 ? (
          <EmptyState query={query}/>
        ) : (
          <ResultsList users={filtered}/>
        )}
      </div>
    </div>
  );
}

function SuggestedSection() {
  // The "suggested" section is intentionally sparse — disguise = ordinary
  // contact-search screen. Includes a placeholder row prompting QR-share.
  return (
    <div>
      <div style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2,
        color: DN_COLORS.muted, textTransform: 'uppercase',
        padding: '20px 20px 8px',
      }}>요청 보낸 사용자</div>
      <Row
        idx={1}
        user={PAIR_USERS[1]}
      />
      <div style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2,
        color: DN_COLORS.muted, textTransform: 'uppercase',
        padding: '20px 20px 8px',
      }}>내 ID 공유</div>
      <div style={{
        background: '#fff', margin: '0 16px', borderRadius: 14,
        padding: 18,
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {/* QR placeholder */}
        <div style={{
          width: 64, height: 64,
          borderRadius: 10,
          background: `repeating-conic-gradient(#1d1d1f 0 25%, #fff 0 50%)`,
          backgroundSize: '14px 14px',
          backgroundPosition: 'center',
          border: '0.5px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: DN_COLORS.text }}>
            내 사용자 ID
          </div>
          <div style={{
            fontFamily: DN_FONT_MONO, fontSize: 14,
            color: DN_COLORS.accent, marginTop: 4, letterSpacing: 0.2,
          }}>@junkyu_2026</div>
          <div style={{ fontSize: 11, color: DN_COLORS.muted, marginTop: 2 }}>
            상대에게 공유해 추가 요청을 받을 수 있어요.
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query }) {
  return (
    <div style={{
      padding: '60px 32px',
      textAlign: 'center',
      color: DN_COLORS.muted,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 999,
        background: '#fff',
        margin: '0 auto 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="14" cy="14" r="9" stroke="#c5c5c7" strokeWidth="2"/>
          <path d="M21 21l6 6" stroke="#c5c5c7" strokeWidth="2" strokeLinecap="round"/>
          <path d="M14 11v6M11 14h6" stroke="#c5c5c7" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: DN_COLORS.text }}>
        "{query}" 와 일치하는 사용자 없음
      </div>
      <div style={{ fontSize: 13, color: DN_COLORS.muted, marginTop: 6, lineHeight: 1.5 }}>
        대소문자를 정확히 확인하거나<br/>
        QR 코드로 직접 공유해보세요.
      </div>
    </div>
  );
}

function ResultsList({ users }) {
  return (
    <div>
      <div style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2,
        color: DN_COLORS.muted, textTransform: 'uppercase',
        padding: '16px 20px 8px',
      }}>검색 결과 · {users.length}</div>
      <div style={{
        background: '#fff', margin: '0 16px', borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {users.map((u, i) => (
          <Row key={u.id} user={u} idx={i} isLast={i === users.length - 1}/>
        ))}
      </div>
    </div>
  );
}

function Row({ user, idx, isLast }) {
  return (
    <div style={{
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'relative',
    }}>
      <PairAvatar name={user.name} idx={idx}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: DN_COLORS.text, letterSpacing: -0.2 }}>
          {user.name}
        </div>
        <div style={{
          fontFamily: DN_FONT_MONO, fontSize: 12,
          color: DN_COLORS.muted, marginTop: 2, letterSpacing: 0.1,
        }}>@{user.id} · {user.tagline}</div>
      </div>
      <StatusPill status={user.status}/>
      {!isLast && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0, left: 70,
          height: 0.5, background: DN_COLORS.separator,
        }}/>
      )}
    </div>
  );
}

window.PairingSearchScreen = PairingSearchScreen;
