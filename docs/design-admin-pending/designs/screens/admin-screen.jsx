// AdminScreen — 내부 관리자 모바일 앱
// MVP DB 관리 항목을 모바일로 노출:
//   1. 사용자 관리 (조회 / 검색 / 차단 / 삭제)
//   2. ARM 관리 — 잠금 코드 시퀀스 (= 카테고리 pill 5→3→1→7) per user 설정
//   3. 채팅 데이터 관리 — 1:1 채팅방 리스트 + 강제 삭제

const { useState: aUseState, useMemo: aUseMemo, useEffect: aUseEffect } = React;

// ─── Mock data ─────────────────────────────────────────────────────────────
const ADMIN_USERS = [
  { id: 'jun_2026',     name: '전준규',  email: 'jun@daily.com',     joined: '2026-03-12', status: 'active',    paired: 'jiwon_k',    chats: 142, lastSeen: '5분 전' },
  { id: 'jiwon_k',      name: '이지원',  email: 'jiwon@daily.com',   joined: '2026-03-12', status: 'active',    paired: 'jun_2026',   chats: 142, lastSeen: '12분 전' },
  { id: 'minho',        name: '이민호',  email: 'minho@daily.com',   joined: '2026-04-02', status: 'pending',   paired: null,         chats: 0,   lastSeen: '2일 전' },
  { id: 'sara_y',       name: '양사라',  email: 'sara@daily.com',    joined: '2026-04-15', status: 'active',    paired: 'taeho',      chats: 38,  lastSeen: '1시간 전' },
  { id: 'taeho',        name: '김태호',  email: 'taeho@daily.com',   joined: '2026-04-15', status: 'active',    paired: 'sara_y',     chats: 38,  lastSeen: '3시간 전' },
  { id: 'euna',         name: '최은아',  email: 'euna@daily.com',    joined: '2026-05-01', status: 'active',    paired: 'jh_park',    chats: 89,  lastSeen: '방금' },
  { id: 'jh_park',      name: '박재현',  email: 'jh@daily.com',      joined: '2026-05-01', status: 'active',    paired: 'euna',       chats: 89,  lastSeen: '6분 전' },
  { id: '소연',         name: '안소연',  email: 'soyeon@daily.com',  joined: '2026-05-10', status: 'blocked',   paired: null,         chats: 0,   lastSeen: '7일 전' },
  { id: '도윤',         name: '도윤',    email: 'doyun@daily.com',   joined: '2026-05-12', status: 'pending',   paired: null,         chats: 0,   lastSeen: '한 번도' },
];

const CATEGORIES_ADMIN = [
  { pos: 1, label: '헤드라인' }, { pos: 2, label: '정치' },
  { pos: 3, label: '경제' },     { pos: 4, label: '기술' },
  { pos: 5, label: '문화' },     { pos: 6, label: '스포츠' },
  { pos: 7, label: '사회' },
];

const DEFAULT_ARM_SEQUENCE   = [5, 3, 1, 7];  // → 채팅 unlock
const DEFAULT_ADMIN_SEQUENCE = [7, 1, 3, 5];  // → Admin 콘솔 진입

const ADMIN_CHATS = [
  { id: 'rm_001', users: ['jun_2026', 'jiwon_k'], msgs: 142, attachments: 18, size: '32.4 MB', lastActivity: '5분 전', created: '2026-03-14' },
  { id: 'rm_002', users: ['sara_y', 'taeho'],     msgs: 38,  attachments: 4,  size: '8.1 MB',  lastActivity: '1시간 전', created: '2026-04-16' },
  { id: 'rm_003', users: ['euna', 'jh_park'],     msgs: 89,  attachments: 11, size: '21.2 MB', lastActivity: '방금', created: '2026-05-02' },
];

// ─── Icons ─────────────────────────────────────────────────────────────────
const AdminIcon = {
  users: (a) => <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="7" r="3.5" stroke={a?'#fff':'#86868b'} strokeWidth="1.7"/>
    <path d="M4 19c0-3.5 3-6 7-6s7 2.5 7 6" stroke={a?'#fff':'#86868b'} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>,
  arm: (a) => <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="4" y="9" width="14" height="10" rx="2" stroke={a?'#fff':'#86868b'} strokeWidth="1.7"/>
    <path d="M7 9V6.5a4 4 0 018 0V9" stroke={a?'#fff':'#86868b'} strokeWidth="1.7"/>
    <circle cx="11" cy="14" r="1.5" fill={a?'#fff':'#86868b'}/>
  </svg>,
  chat: (a) => <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M3 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 3v-3a2 2 0 01-1-2V6z" stroke={a?'#fff':'#86868b'} strokeWidth="1.7" strokeLinejoin="round"/>
  </svg>,
  home: (a) => <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M4 10l7-6 7 6v8a1 1 0 01-1 1h-4v-5h-4v5H5a1 1 0 01-1-1v-8z" stroke={a?'#fff':'#86868b'} strokeWidth="1.7" strokeLinejoin="round"/>
  </svg>,
  search: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke="#86868b" strokeWidth="1.6"/><path d="M11 11l4 4" stroke="#86868b" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>,
  back: () => <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
    <path d="M11 2L2 11l9 9" stroke="#ff6b3b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  chevron: () => <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
    <path d="M1 1l6 6-6 6" stroke="#c5c5c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  trash: () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M3 5h12M7 5V3a1 1 0 011-1h2a1 1 0 011 1v2M5 5l1 11a1 1 0 001 1h4a1 1 0 001-1l1-11" stroke="#ff453a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>,
  edit: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 12L12 3l2 2-9 9H3v-2z" stroke="#ff6b3b" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>,
};

// Admin color tokens — utilitarian darker palette to distinguish from disguise
const ADMIN = {
  bg: '#0e1116',
  surface: '#1c1f26',
  surfaceAlt: '#262a33',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#f5f5f7',
  textDim: '#9aa0a8',
  textMuted: '#6c707a',
  accent: '#ff6b3b',  // distinct from #007aff disguise accent → admin signals "internal"
  accentSoft: 'rgba(255,107,59,0.16)',
  ok: '#34c759',
  warn: '#ff9500',
  danger: '#ff453a',
};

const ADMIN_FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const ADMIN_FONT_DISPLAY = '-apple-system, "SF Pro Display", sans-serif';
const ADMIN_FONT_MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

// ─── Shared components ────────────────────────────────────────────────────
function AdminHeader({ title, leftLabel, onBack, right }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(14,17,22,0.88)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '0.5px solid ' + ADMIN.border,
      padding: '8px 8px 10px',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', minHeight: 44,
      color: ADMIN.text,
    }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 8px',
        color: ADMIN.accent, fontFamily: ADMIN_FONT,
        fontSize: 17, letterSpacing: -0.4,
        justifySelf: 'start',
        visibility: leftLabel ? 'visible' : 'hidden',
      }}>
        {AdminIcon.back()} <span>{leftLabel || ''}</span>
      </button>
      <div style={{
        fontFamily: ADMIN_FONT, fontSize: 15, fontWeight: 600,
        letterSpacing: -0.2, justifySelf: 'center',
      }}>{title}</div>
      <div style={{ justifySelf: 'end', padding: '0 12px' }}>{right}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active:  { label: '활성',  bg: 'rgba(52,199,89,0.16)',  fg: ADMIN.ok },
    pending: { label: '미인증', bg: 'rgba(255,149,0,0.16)',  fg: ADMIN.warn },
    blocked: { label: '차단됨', bg: 'rgba(255,69,58,0.16)',  fg: ADMIN.danger },
  };
  const s = map[status];
  return (
    <span style={{
      background: s.bg, color: s.fg,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
      padding: '2px 8px', borderRadius: 999,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: ADMIN_FONT,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: s.fg }}/>
      {s.label}
    </span>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      background: ADMIN.surface, borderRadius: 12,
      padding: '14px 14px', border: '0.5px solid ' + ADMIN.border,
      flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
        color: ADMIN.textMuted, textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: ADMIN_FONT_DISPLAY,
        fontSize: 24, fontWeight: 700, letterSpacing: -0.5,
        color: accent || ADMIN.text, lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function Card({ children, padding = 0 }) {
  return (
    <div style={{
      background: ADMIN.surface,
      borderRadius: 14,
      border: '0.5px solid ' + ADMIN.border,
      overflow: 'hidden',
      padding,
    }}>{children}</div>
  );
}

function Avatar({ name, size = 36, dim }) {
  // hash-derived hue
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: dim
        ? `linear-gradient(135deg, hsl(${h}, 10%, 35%), hsl(${h}, 10%, 25%))`
        : `linear-gradient(135deg, hsl(${h}, 38%, 55%), hsl(${h}, 38%, 38%))`,
      color: '#fff', fontSize: size * 0.4, fontWeight: 600,
      letterSpacing: -0.3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontFamily: ADMIN_FONT_DISPLAY,
    }}>{name.charAt(0)}</div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME / OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════
function HomeView({ goto }) {
  const stats = aUseMemo(() => ({
    users: ADMIN_USERS.length,
    active: ADMIN_USERS.filter(u => u.status === 'active').length,
    pending: ADMIN_USERS.filter(u => u.status === 'pending').length,
    blocked: ADMIN_USERS.filter(u => u.status === 'blocked').length,
    chats: ADMIN_CHATS.length,
    messages: ADMIN_CHATS.reduce((s, c) => s + c.msgs, 0),
  }), []);

  return (
    <div>
      <AdminHeader title="DailyNews · Admin" right={
        <div style={{
          fontSize: 11, fontFamily: ADMIN_FONT_MONO,
          color: ADMIN.textMuted, letterSpacing: 0.3,
        }}>v0.4-mvp</div>
      }/>
      <div style={{ padding: '16px 16px 100px' }}>
        <div style={{
          fontFamily: ADMIN_FONT_DISPLAY,
          fontSize: 28, fontWeight: 700, letterSpacing: -0.6,
          color: ADMIN.text, marginBottom: 4,
        }}>관리자 콘솔</div>
        <div style={{ fontSize: 13, color: ADMIN.textDim, marginBottom: 18 }}>
          DB 직접 관리 · MVP 운영
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          <Stat label="전체 사용자" value={stats.users}/>
          <Stat label="활성 채팅방" value={stats.chats} accent={ADMIN.accent}/>
          <Stat label="누적 메시지" value={stats.messages}/>
        </div>

        <div style={{
          fontSize: 12, fontWeight: 600, letterSpacing: 1,
          color: ADMIN.textMuted, textTransform: 'uppercase',
          marginBottom: 10,
        }}>관리 메뉴</div>
        <Card>
          <MenuRow icon={AdminIcon.users(true)} label="사용자 관리"
            detail={`${stats.active} 활성 · ${stats.pending} 미인증 · ${stats.blocked} 차단`}
            onTap={() => goto('users')}/>
          <Sep/>
          <MenuRow icon={AdminIcon.arm(true)} label="ARM 관리"
            detail={`기본 시퀀스 5→3→1→7 · ${stats.active} 사용자 적용`}
            onTap={() => goto('arm')}/>
          <Sep/>
          <MenuRow icon={AdminIcon.chat(true)} label="채팅 데이터 관리"
            detail={`${stats.chats} 채팅방 · ${stats.messages} 메시지`}
            onTap={() => goto('chats')}/>
        </Card>

        {/* MVP note */}
        <div style={{
          marginTop: 22,
          background: ADMIN.accentSoft,
          border: '0.5px solid rgba(255,107,59,0.3)',
          borderRadius: 12, padding: '12px 14px',
          fontSize: 12, color: '#ffc7a8', lineHeight: 1.5,
        }}>
          <b style={{ color: '#ffe5d4' }}>MVP 운영 정책</b><br/>
          잠금 코드와 페어 연결은 이 콘솔에서 직접 관리. 사용자 앱에는 설정 UI 없음.
        </div>

        <div style={{
          marginTop: 18, fontSize: 12, color: ADMIN.textMuted,
          textAlign: 'center', lineHeight: 1.7,
        }}>
          DailyNews Admin · 2026.05.25<br/>
          internal use only
        </div>
      </div>
    </div>
  );
}

function MenuRow({ icon, label, detail, onTap }) {
  return (
    <div onClick={onTap} style={{
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: ADMIN.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: ADMIN.text, letterSpacing: -0.2 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: ADMIN.textDim, marginTop: 2, letterSpacing: -0.1 }}>
          {detail}
        </div>
      </div>
      {AdminIcon.chevron()}
    </div>
  );
}

function Sep() {
  return <div style={{ height: 0.5, background: ADMIN.border, marginLeft: 66 }}/>;
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS LIST + DETAIL
// ═══════════════════════════════════════════════════════════════════════════
function UsersView({ goto, openUser }) {
  const [q, setQ] = aUseState('');

  const filtered = aUseMemo(() => {
    return ADMIN_USERS.filter(u => {
      if (q.trim() && !(u.id.includes(q) || u.name.includes(q) || u.email.includes(q))) return false;
      return true;
    });
  }, [q]);

  return (
    <div>
      <AdminHeader title="사용자 관리" leftLabel="홈" onBack={() => goto('home')}
        right={<button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: ADMIN.accent, fontFamily: ADMIN_FONT, fontSize: 17, fontWeight: 600,
          padding: '6px 8px',
        }}>+</button>}/>
      <div style={{ padding: '14px 16px 100px' }}>
        {/* search */}
        <div style={{
          background: ADMIN.surface, borderRadius: 10,
          padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8,
          border: '0.5px solid ' + ADMIN.border,
        }}>
          {AdminIcon.search()}
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="이름 / ID / 이메일 검색"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: ADMIN_FONT, fontSize: 15, color: ADMIN.text,
              letterSpacing: -0.2,
            }}/>
        </div>

        {/* segmented filter 제거 — 사용자 목록만 그대로 노출 */}

        {/* list */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          color: ADMIN.textMuted, textTransform: 'uppercase',
          margin: '20px 4px 8px',
        }}>{filtered.length} 명</div>
        <Card>
          {filtered.map((u, i) => (
            <div key={u.id}>
              <UserRow user={u} onTap={() => openUser(u.id)}/>
              {i < filtered.length - 1 && <Sep/>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              color: ADMIN.textMuted, fontSize: 14,
            }}>일치하는 사용자 없음</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function UserRow({ user, onTap }) {
  return (
    <div onClick={onTap} style={{
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer',
    }}>
      <Avatar name={user.name}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: ADMIN.text, letterSpacing: -0.2 }}>
          {user.name}
        </div>
        <div style={{
          fontSize: 12, color: ADMIN.textDim,
          fontFamily: ADMIN_FONT_MONO, letterSpacing: 0.1,
          marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>@{user.id} · {user.email}</div>
        <div style={{ fontSize: 11, color: ADMIN.textMuted, marginTop: 3 }}>
          {user.paired ? <>페어 <b style={{ color: ADMIN.textDim }}>@{user.paired}</b> · </> : '페어 없음 · '}
          {user.lastSeen}
        </div>
      </div>
      {AdminIcon.chevron()}
    </div>
  );
}

function UserDetailView({ userId, goto }) {
  const user = ADMIN_USERS.find(u => u.id === userId);
  if (!user) return null;
  const peer = user.paired ? ADMIN_USERS.find(u => u.id === user.paired) : null;

  return (
    <div>
      <AdminHeader title="사용자 상세" leftLabel="목록" onBack={() => goto('users')}/>
      <div style={{ padding: '16px 16px 100px' }}>
        {/* header card */}
        <div style={{
          background: ADMIN.surface, borderRadius: 14,
          border: '0.5px solid ' + ADMIN.border,
          padding: 18, textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Avatar name={user.name} size={72}/>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: ADMIN.text }}>
            {user.name}
          </div>
          <div style={{
            fontFamily: ADMIN_FONT_MONO, fontSize: 13,
            color: ADMIN.textDim, marginTop: 4,
          }}>@{user.id}</div>
        </div>

        {/* facts */}
        <SectionLabel>계정 정보</SectionLabel>
        <Card>
          <Field label="이메일" value={user.email}/>
          <Sep/>
          <Field label="사용자 ID" value={`@${user.id}`} mono/>
          <Sep/>
          <Field label="가입일" value={user.joined}/>
          <Sep/>
          <Field label="마지막 접속" value={user.lastSeen}/>
        </Card>

        <SectionLabel>페어</SectionLabel>
        <Card>
          {peer ? (
            <div style={{
              padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Avatar name={peer.name} size={36}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: ADMIN.text }}>{peer.name}</div>
                <div style={{
                  fontSize: 12, color: ADMIN.textDim,
                  fontFamily: ADMIN_FONT_MONO, marginTop: 2,
                }}>@{peer.id}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 14, color: ADMIN.textDim, fontSize: 14 }}>
              페어 없음
            </div>
          )}
        </Card>

        <SectionLabel>활동</SectionLabel>
        <Card>
          <Field label="누적 메시지" value={`${user.chats} 건`}/>
          <Sep/>
          <Field label="상태" value={user.status === 'active' ? '활성' : user.status === 'pending' ? '미인증' : '차단됨'}/>
        </Card>
      </div>
    </div>
  );
}

function SectionLabel({ children, danger }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 1,
      color: danger ? ADMIN.danger : ADMIN.textMuted,
      textTransform: 'uppercase',
      margin: '24px 4px 8px',
    }}>{children}</div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{
      padding: '12px 14px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 13, color: ADMIN.textDim, letterSpacing: -0.1 }}>{label}</div>
      <div style={{
        fontSize: 14, color: ADMIN.text,
        fontFamily: mono ? ADMIN_FONT_MONO : ADMIN_FONT,
        letterSpacing: mono ? 0.1 : -0.1,
        textAlign: 'right',
        maxWidth: '60%',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value}</div>
    </div>
  );
}

function ActionRow({ label, danger }) {
  return (
    <div style={{
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer',
    }}>
      <span style={{
        fontSize: 15, fontWeight: 500,
        color: danger ? ADMIN.danger : ADMIN.text,
        letterSpacing: -0.2,
      }}>{label}</span>
      {AdminIcon.chevron()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ARM (잠금 코드) MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
function ArmView({ goto }) {
  // 두 시퀀스: 채팅 unlock + Admin 진입.
  const [sequences, setSequences] = aUseState({
    chat:  DEFAULT_ARM_SEQUENCE,
    admin: DEFAULT_ADMIN_SEQUENCE,
  });
  const [target, setTarget] = aUseState('chat'); // 'chat' | 'admin'
  const [editing, setEditing] = aUseState(false);
  const [draft, setDraft] = aUseState([]);

  const TARGET_META = {
    chat:  { label: '채팅 unlock', sub: '일반 사용자 → 채팅 모드',  accent: ADMIN.accent, accentSoft: ADMIN.accentSoft },
    admin: { label: 'Admin 진입',  sub: '관리자 → 이 콘솔',         accent: '#ff9500',    accentSoft: 'rgba(255,149,0,0.16)' },
  };
  const meta = TARGET_META[target];
  const sequence = sequences[target];

  const startEdit = () => { setDraft([]); setEditing(true); };
  const onPillTap = (pos) => {
    if (!editing) return;
    if (draft.length >= 4) return;
    if (draft.includes(pos)) return;
    setDraft([...draft, pos]);
  };
  const reset = () => setDraft([]);
  const save = () => {
    setSequences({ ...sequences, [target]: draft });
    setEditing(false);
  };
  const switchTarget = (t) => {
    if (editing) return; // editing 중에는 전환 금지
    setTarget(t);
  };

  return (
    <div>
      <AdminHeader title="ARM 관리" leftLabel="홈" onBack={() => goto('home')}/>
      <div style={{ padding: '16px 16px 100px' }}>
        <div style={{ fontSize: 13, color: ADMIN.textDim, marginBottom: 18, lineHeight: 1.5 }}>
          ARM 시퀀스는 카테고리 pill 의 <b style={{ color: ADMIN.text }}>position 1~7</b> 중 4개. 사용자 앱은 두 시퀀스를 동시 검증해 매치되는 쪽으로 라우팅합니다.
        </div>

        {/* 타겟 segmented control */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 14,
          background: ADMIN.surface, padding: 4, borderRadius: 10,
          border: '0.5px solid ' + ADMIN.border,
          opacity: editing ? 0.5 : 1,
          pointerEvents: editing ? 'none' : 'auto',
        }}>
          {['chat', 'admin'].map((t) => {
            const m = TARGET_META[t];
            const active = target === t;
            return (
              <button key={t} onClick={() => switchTarget(t)} style={{
                flex: 1, padding: '10px 8px',
                background: active ? m.accent : 'transparent',
                color: active ? '#fff' : ADMIN.textDim,
                fontWeight: 600, fontSize: 13, letterSpacing: -0.1,
                border: 'none', borderRadius: 7, cursor: 'pointer',
                fontFamily: ADMIN_FONT, transition: 'all 150ms',
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                <div style={{
                  fontSize: 10, marginTop: 2, fontWeight: 500,
                  color: active ? 'rgba(255,255,255,0.85)' : ADMIN.textMuted,
                  letterSpacing: -0.05,
                }}>{m.sub}</div>
              </button>
            );
          })}
        </div>

        <SectionLabel>{meta.label} 시퀀스</SectionLabel>
        <Card padding="14px">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(editing ? (draft.length === 4 ? draft : [...draft, ...Array(4 - draft.length).fill(null)]) : sequence).map((pos, i) => (
              <div key={i} style={{
                flex: 1,
                background: pos ? meta.accent : ADMIN.surfaceAlt,
                padding: '12px 6px', borderRadius: 10,
                textAlign: 'center',
                border: '0.5px solid ' + (pos ? 'transparent' : ADMIN.border),
                transition: 'all 150ms',
              }}>
                <div style={{
                  fontFamily: ADMIN_FONT_DISPLAY,
                  fontSize: 24, fontWeight: 700,
                  color: pos ? '#fff' : ADMIN.textMuted,
                  letterSpacing: -0.5, lineHeight: 1,
                }}>{pos || '?'}</div>
                <div style={{
                  fontSize: 10, fontWeight: 500, marginTop: 4,
                  color: pos ? 'rgba(255,255,255,0.85)' : ADMIN.textMuted,
                }}>
                  {pos ? CATEGORIES_ADMIN.find(c => c.pos === pos)?.label : '—'}
                </div>
              </div>
            ))}
          </div>

          {editing ? (
            <>
              <div style={{ fontSize: 12, color: ADMIN.textMuted, marginBottom: 8, textAlign: 'center' }}>
                <b style={{ color: meta.accent }}>{meta.label}</b> 시퀀스 — 4개를 순서대로 선택 ({draft.length}/4)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {CATEGORIES_ADMIN.map(c => {
                  const used = draft.includes(c.pos);
                  const order = draft.indexOf(c.pos) + 1;
                  return (
                    <button key={c.pos} onClick={() => onPillTap(c.pos)}
                      disabled={used}
                      style={{
                        background: used ? meta.accentSoft : ADMIN.surfaceAlt,
                        color: used ? meta.accent : ADMIN.text,
                        border: '0.5px solid ' + (used ? 'transparent' : ADMIN.border),
                        borderRadius: 8, padding: '8px 4px',
                        fontFamily: ADMIN_FONT, fontSize: 12, fontWeight: 600,
                        cursor: used ? 'default' : 'pointer',
                        position: 'relative',
                        transition: 'all 120ms',
                      }}>
                      <div style={{
                        fontSize: 9, color: ADMIN.textMuted, fontFamily: ADMIN_FONT_MONO,
                        letterSpacing: 0.4, marginBottom: 2,
                      }}>#{c.pos}</div>
                      {c.label}
                      {used && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 14, height: 14, borderRadius: 999,
                          background: meta.accent, color: '#fff',
                          fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{order}</div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={reset} style={{
                  flex: 1, padding: '10px',
                  background: ADMIN.surfaceAlt, color: ADMIN.text,
                  border: '0.5px solid ' + ADMIN.border, borderRadius: 9,
                  fontFamily: ADMIN_FONT, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}>다시 시작</button>
                <button onClick={save} disabled={draft.length !== 4} style={{
                  flex: 1, padding: '10px',
                  background: draft.length === 4 ? meta.accent : ADMIN.surfaceAlt,
                  color: draft.length === 4 ? '#fff' : ADMIN.textMuted,
                  border: 'none', borderRadius: 9,
                  fontFamily: ADMIN_FONT, fontSize: 14, fontWeight: 600,
                  cursor: draft.length === 4 ? 'pointer' : 'default',
                }}>저장</button>
              </div>
            </>
          ) : (
            <button onClick={startEdit} style={{
              width: '100%', padding: 10,
              background: meta.accentSoft, color: meta.accent,
              border: '0.5px solid ' + ADMIN.border, borderRadius: 9,
              fontFamily: ADMIN_FONT, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}>{meta.label} 시퀀스 편집</button>
          )}
        </Card>

        <SectionLabel>카테고리 위치 매핑</SectionLabel>
        <Card>
          {CATEGORIES_ADMIN.map((c, i) => {
            const chatStep  = sequences.chat.indexOf(c.pos);
            const adminStep = sequences.admin.indexOf(c.pos);
            return (
              <div key={c.pos}>
                <div style={{
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: ADMIN.surfaceAlt, color: ADMIN.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, fontFamily: ADMIN_FONT_MONO,
                      border: '0.5px solid ' + ADMIN.border, flexShrink: 0,
                    }}>{c.pos}</div>
                    <div style={{ fontSize: 14, color: ADMIN.text }}>{c.label}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {chatStep >= 0 && (
                      <div style={{
                        fontSize: 10, color: TARGET_META.chat.accent, fontWeight: 700,
                        background: TARGET_META.chat.accentSoft,
                        padding: '2px 8px', borderRadius: 999, fontFamily: ADMIN_FONT_MONO,
                        letterSpacing: 0.2,
                      }}>chat·{chatStep + 1}</div>
                    )}
                    {adminStep >= 0 && (
                      <div style={{
                        fontSize: 10, color: TARGET_META.admin.accent, fontWeight: 700,
                        background: TARGET_META.admin.accentSoft,
                        padding: '2px 8px', borderRadius: 999, fontFamily: ADMIN_FONT_MONO,
                        letterSpacing: 0.2,
                      }}>admin·{adminStep + 1}</div>
                    )}
                  </div>
                </div>
                {i < CATEGORIES_ADMIN.length - 1 && <Sep/>}
              </div>
            );
          })}
        </Card>

        <div style={{
          marginTop: 22, fontSize: 12, color: ADMIN.textMuted, lineHeight: 1.5,
          padding: '12px 14px', background: ADMIN.surfaceAlt, borderRadius: 10,
        }}>
          <b style={{ color: ADMIN.textDim }}>주의.</b> 시퀀스 변경 시 해당 타겟의 기존 토큰이 즉시 무효화됩니다.
          <br/>두 시퀀스가 겹치지 않도록 주의 (겹치면 라우팅 충돌).
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAT DATA MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
function ChatsView({ goto }) {
  const [selectedId, setSelectedId] = aUseState(null);
  const total = aUseMemo(() => ({
    rooms: ADMIN_CHATS.length,
    msgs: ADMIN_CHATS.reduce((s, c) => s + c.msgs, 0),
    attachments: ADMIN_CHATS.reduce((s, c) => s + c.attachments, 0),
  }), []);

  return (
    <div>
      <AdminHeader title="채팅 데이터" leftLabel="홈" onBack={() => goto('home')}/>
      <div style={{ padding: '16px 16px 100px' }}>
        {/* totals */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          <Stat label="채팅방" value={total.rooms} accent={ADMIN.accent}/>
          <Stat label="메시지" value={total.msgs}/>
          <Stat label="첨부" value={total.attachments}/>
        </div>

        <SectionLabel>1:1 채팅방 ({ADMIN_CHATS.length})</SectionLabel>
        <Card>
          {ADMIN_CHATS.map((c, i) => (
            <div key={c.id}>
              <ChatRow chat={c} onTap={() => setSelectedId(c.id)} selected={selectedId === c.id}/>
              {selectedId === c.id && <ChatDetail chat={c} onClose={() => setSelectedId(null)}/>}
              {i < ADMIN_CHATS.length - 1 && <Sep/>}
            </div>
          ))}
        </Card>

        <SectionLabel danger>일괄 작업</SectionLabel>
        <Card>
          <ActionRow danger label="30일 이상 비활성 채팅방 일괄 삭제"/>
          <Sep/>
          <ActionRow danger label="전체 첨부 파일 일괄 삭제"/>
        </Card>

        <div style={{
          marginTop: 22, fontSize: 12, color: ADMIN.textMuted, lineHeight: 1.5,
          padding: '12px 14px', background: ADMIN.surfaceAlt, borderRadius: 10,
        }}>
          <b style={{ color: ADMIN.textDim }}>삭제 정책.</b> 채팅방 삭제는 cascade —
          messages · attachments · room 전체. 사용자에겐 위장 푸시 "구독자 정보 동기화" 발송.
        </div>
      </div>
    </div>
  );
}

function ChatRow({ chat, onTap, selected }) {
  const [u1, u2] = chat.users.map(id => ADMIN_USERS.find(u => u.id === id));
  return (
    <div onClick={onTap} style={{
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer',
      background: selected ? 'rgba(255,107,59,0.06)' : 'transparent',
      transition: 'background 120ms',
    }}>
      {/* pair avatars */}
      <div style={{ position: 'relative', width: 44, height: 36, flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0 }}><Avatar name={u1?.name || '?'} size={28}/></div>
        <div style={{ position: 'absolute', right: 0, bottom: 0, border: '2px solid ' + ADMIN.surface, borderRadius: 999 }}>
          <Avatar name={u2?.name || '?'} size={28}/>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: ADMIN.text, letterSpacing: -0.2,
        }}>
          {u1?.name} ↔ {u2?.name}
        </div>
        <div style={{
          fontSize: 11.5, color: ADMIN.textDim,
          marginTop: 2, fontFamily: ADMIN_FONT_MONO, letterSpacing: 0.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{chat.id} · {chat.msgs} msgs · {chat.size}</div>
      </div>
      <div style={{ fontSize: 11, color: ADMIN.textMuted, textAlign: 'right' }}>
        {chat.lastActivity}
      </div>
    </div>
  );
}

function ChatDetail({ chat, onClose }) {
  const [u1, u2] = chat.users.map(id => ADMIN_USERS.find(u => u.id === id));
  return (
    <div style={{
      background: ADMIN.surfaceAlt,
      padding: '14px 14px',
      borderTop: '0.5px solid ' + ADMIN.border,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ADMIN.text, letterSpacing: -0.1 }}>
          채팅방 상세
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: ADMIN.textDim, fontSize: 12,
          fontFamily: ADMIN_FONT,
        }}>닫기</button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: ADMIN.textDim, lineHeight: 1.7 }}>
        <Row k="Room ID"     v={chat.id}/>
        <Row k="페어"         v={`${u1?.name} ↔ ${u2?.name}`}/>
        <Row k="개설일"       v={chat.created}/>
        <Row k="메시지"       v={`${chat.msgs} 건`}/>
        <Row k="첨부"        v={`${chat.attachments} 개`}/>
        <Row k="용량"        v={chat.size}/>
        <Row k="마지막 활동"  v={chat.lastActivity}/>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={{
          flex: 1, padding: '8px',
          background: ADMIN.surface, color: ADMIN.text,
          border: '0.5px solid ' + ADMIN.border, borderRadius: 8,
          fontFamily: ADMIN_FONT, fontSize: 13, fontWeight: 500,
          cursor: 'pointer',
        }}>메시지 내보내기</button>
        <button style={{
          flex: 1, padding: '8px',
          background: 'rgba(255,69,58,0.16)', color: ADMIN.danger,
          border: '0.5px solid rgba(255,69,58,0.3)', borderRadius: 8,
          fontFamily: ADMIN_FONT, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}>채팅방 삭제</button>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span>{k}</span>
      <span style={{ color: ADMIN.text, fontFamily: ADMIN_FONT_MONO, letterSpacing: 0.1 }}>{v}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════════════════════════════════════
function AdminTabBar({ tab, setTab }) {
  const tabs = [
    { id: 'home',  label: '홈',       Icon: AdminIcon.home },
    { id: 'users', label: '사용자',    Icon: AdminIcon.users },
    { id: 'arm',   label: 'ARM',     Icon: AdminIcon.arm },
    { id: 'chats', label: '채팅',     Icon: AdminIcon.chat },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 30, paddingTop: 8,
      background: 'rgba(14,17,22,0.88)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '0.5px solid ' + ADMIN.border,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      zIndex: 30,
    }}>
      {tabs.map(({ id, label, Icon: I }) => {
        const active = tab === id || (id === 'users' && tab === 'user') || (id === 'chats' && tab === 'chat');
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'none', border: 'none', padding: '4px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            fontFamily: ADMIN_FONT, cursor: 'pointer',
          }}>
            <I active={active}/>
            <span style={{
              fontSize: 10.5, fontWeight: 500,
              color: active ? '#fff' : ADMIN.textMuted,
              letterSpacing: -0.1,
            }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
function AdminScreen({ initialTab = 'home', initialUserId = null } = {}) {
  const [tab, setTab] = aUseState(initialTab);
  const [selectedUserId, setSelectedUserId] = aUseState(initialUserId);

  const goto = (next) => {
    setTab(next);
    setSelectedUserId(null);
  };
  const openUser = (userId) => {
    setSelectedUserId(userId);
    setTab('user');
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: ADMIN.bg,
      color: ADMIN.text,
      fontFamily: ADMIN_FONT,
      position: 'relative', overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 84 }}>
        {tab === 'home'  && <HomeView goto={goto}/>}
        {tab === 'users' && <UsersView goto={goto} openUser={openUser}/>}
        {tab === 'user'  && <UserDetailView userId={selectedUserId} goto={goto}/>}
        {tab === 'arm'   && <ArmView goto={goto}/>}
        {tab === 'chats' && <ChatsView goto={goto}/>}
      </div>
      <AdminTabBar tab={tab} setTab={goto}/>
    </div>
  );
}

window.AdminScreen = AdminScreen;
