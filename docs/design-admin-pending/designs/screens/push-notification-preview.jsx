// Push Notification previews — iOS lock screen, iOS banner, Android lock screen
// All show ONLY the disguise headline. No data payload, no message body, no "📨".

const { useState, useEffect } = React;

const NOTIF = {
  title: '📰 새 뉴스',
  body: 'AI 모델 공개 — 안전성 논쟁 가열',
  source: '테크와이어',
  time: '방금',
};

// ─── iOS lock screen ───────────────────────────────────────────────────────
function IOSLockScreen() {
  // Match a clean iOS-17-style lock layout — time, date, notification stack
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(circle at 30% 0%, #3a4d6b 0%, #1a2238 45%, #0b0f1f 100%)
      `,
      overflow: 'hidden',
      fontFamily: DN_FONT,
      color: '#fff',
    }}>
      {/* subtle photo-y texture using gradients */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(800px 400px at 80% 110%, rgba(135,165,210,0.18) 0%, transparent 60%)',
      }}/>

      {/* top: lock + date + time */}
      <div style={{
        position: 'absolute', top: 78, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: 2,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: 'rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          <svg width="13" height="16" viewBox="0 0 13 16" fill="none">
            <path d="M3 7V4.5a3.5 3.5 0 117 0V7" stroke="#fff" strokeWidth="1.6"/>
            <rect x="1.5" y="7" width="10" height="8" rx="1.6" fill="#fff"/>
          </svg>
        </div>
        <div style={{
          fontSize: 17, fontWeight: 400, color: '#fff',
          marginTop: 30, letterSpacing: 0.2,
        }}>수요일, 5월 20일</div>
        <div style={{
          fontFamily: DN_FONT_DISPLAY,
          fontSize: 96, fontWeight: 300, letterSpacing: -3,
          lineHeight: 1, marginTop: 4, color: '#fff',
        }}>9:41</div>
      </div>

      {/* notification stack */}
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 130,
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 2,
      }}>
        <NotifCardIOS featured/>
        {/* stacked older notif (peek) */}
        <div style={{
          margin: '0 8px',
          height: 8,
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 14,
        }}/>
      </div>

      {/* bottom: flashlight + camera + home indicator */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 50,
        display: 'flex', justifyContent: 'space-between', padding: '0 36px',
        zIndex: 2,
      }}>
        <LockOrb icon="flash"/>
        <LockOrb icon="cam"/>
      </div>
    </div>
  );
}

function LockOrb({ icon }) {
  return (
    <div style={{
      width: 50, height: 50, borderRadius: 999,
      background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icon === 'flash' ? (
        <svg width="20" height="22" viewBox="0 0 20 22"><path d="M11 1L3 13h6l-1 8 8-12h-6l1-8z" fill="#fff"/></svg>
      ) : (
        <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
          <rect x="1" y="4" width="20" height="14" rx="3" stroke="#fff" strokeWidth="1.6"/>
          <circle cx="11" cy="11" r="4" stroke="#fff" strokeWidth="1.6"/>
          <path d="M8 4l1-2h4l1 2" stroke="#fff" strokeWidth="1.6"/>
        </svg>
      )}
    </div>
  );
}

function NotifCardIOS({ featured }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderRadius: 18,
      padding: '12px 14px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.18)',
    }}>
      <AppIconBadge/>
      <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 2,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.1 }}>
            DAILYNEWS
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>방금</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>
          {NOTIF.title}
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.32, letterSpacing: -0.2 }}>
          {NOTIF.body}
        </div>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.7)',
          marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600,
        }}>{NOTIF.source}</div>
      </div>
    </div>
  );
}

// ─── App icon (disguised news icon) ────────────────────────────────────────
function AppIconBadge({ size = 38 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.24,
      background: 'linear-gradient(140deg, #ffffff 0%, #f0f0f3 100%)',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.25), inset 0 0 0 0.5px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Stylized newspaper masthead — "N" */}
      <div style={{
        fontFamily: '"Georgia", "Times New Roman", serif',
        fontWeight: 900, fontSize: size * 0.58, lineHeight: 1,
        color: '#1d1d1f', letterSpacing: -1.5,
      }}>N</div>
      {/* underline rules */}
      <div style={{
        position: 'absolute', left: '14%', right: '14%', bottom: '20%',
        height: 1, background: '#1d1d1f', opacity: 0.6,
      }}/>
      <div style={{
        position: 'absolute', left: '20%', right: '20%', bottom: '14%',
        height: 1, background: '#1d1d1f', opacity: 0.4,
      }}/>
    </div>
  );
}

// ─── iOS banner (while-in-use, top drop-down) ──────────────────────────────
function IOSBannerOverApp() {
  // Renders an app screen underneath (DailyNews feed faded) + a banner sliding
  // in from the top.
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: DN_COLORS.bg, overflow: 'hidden',
      fontFamily: DN_FONT,
    }}>
      {/* Fake feed underneath */}
      <div style={{
        position: 'absolute', inset: 0,
        padding: '70px 16px 0',
        filter: 'brightness(0.95)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: '#ff3b30', textTransform: 'uppercase' }}>
          2026년 5월 20일 · 수요일
        </div>
        <div style={{ fontFamily: DN_FONT_DISPLAY, fontSize: 30, fontWeight: 800, letterSpacing: -1, marginTop: 2, color: '#1d1d1f' }}>
          DailyNews
        </div>
        <div style={{ marginTop: 20, height: 160, borderRadius: 14, background: 'repeating-linear-gradient(135deg, #dde4ec 0 14px, #ced6df 14px 28px)' }}/>
        <div style={{ marginTop: 14, height: 18, width: '85%', borderRadius: 4, background: '#dcdce0' }}/>
        <div style={{ marginTop: 8, height: 14, width: '70%', borderRadius: 4, background: '#e2e2e6' }}/>
        <div style={{ marginTop: 28, height: 12, width: 80, borderRadius: 4, background: '#dcdce0' }}/>
      </div>

      {/* Banner */}
      <div style={{
        position: 'absolute', top: 12, left: 8, right: 8,
        zIndex: 5,
        background: 'rgba(245,245,247,0.85)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        borderRadius: 22,
        padding: '14px 14px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.4)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        animation: 'dn-banner-in 600ms cubic-bezier(0.2,0.8,0.2,1) both',
      }}>
        <AppIconBadge/>
        <div style={{ flex: 1, minWidth: 0, color: '#1d1d1f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1, color: '#1d1d1f' }}>DAILYNEWS</span>
            <span style={{ fontSize: 12, color: '#86868b' }}>방금</span>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2 }}>{NOTIF.title}</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.32, letterSpacing: -0.2 }}>{NOTIF.body}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Android lock screen (Material 3-ish) ──────────────────────────────────
function AndroidLockScreen() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(circle at 50% 20%, #2a3852 0%, #0e1424 60%, #06091a 100%)
      `,
      fontFamily: DN_FONT,
      color: '#fff',
    }}>
      {/* time + date — left aligned, Material style */}
      <div style={{
        position: 'absolute', top: 86, left: 28, right: 28,
        zIndex: 2,
      }}>
        <div style={{
          fontFamily: DN_FONT_DISPLAY,
          fontSize: 76, fontWeight: 200,
          lineHeight: 1, color: '#fff',
          letterSpacing: -2,
        }}>9:41</div>
        <div style={{
          fontSize: 15, color: 'rgba(255,255,255,0.85)',
          marginTop: 8, fontWeight: 500,
        }}>수요일, 5월 20일 · 18°</div>
      </div>

      {/* notification card */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 180,
        zIndex: 2,
      }}>
        <NotifCardAndroid/>
      </div>

      {/* bottom shortcuts */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 60,
        display: 'flex', justifyContent: 'space-between', padding: '0 28px',
        zIndex: 2,
      }}>
        <LockOrb icon="flash"/>
        <LockOrb icon="cam"/>
      </div>
    </div>
  );
}

function NotifCardAndroid() {
  return (
    <div style={{
      background: 'rgba(220,228,240,0.18)',
      backdropFilter: 'blur(30px) saturate(180%)',
      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
      borderRadius: 24,
      padding: 16,
      boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.18)',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <AppIconBadge size={20}/>
        <div style={{
          fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)',
          letterSpacing: 0.1,
        }}>DailyNews</div>
        <div style={{
          width: 3, height: 3, borderRadius: 999,
          background: 'rgba(255,255,255,0.6)',
        }}/>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>방금</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2, marginBottom: 4 }}>
        {NOTIF.title}
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.92)' }}>
        {NOTIF.body}
      </div>
      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.6)',
        marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600,
      }}>{NOTIF.source}</div>
    </div>
  );
}

window.IOSLockScreen = IOSLockScreen;
window.IOSBannerOverApp = IOSBannerOverApp;
window.AndroidLockScreen = AndroidLockScreen;
window.AppIconBadge = AppIconBadge;
