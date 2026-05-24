// shared.jsx — utilities shared across DailyNews screens

const DN_COLORS = {
  bg: '#f5f5f7',
  surface: '#ffffff',
  text: '#1d1d1f',
  muted: '#86868b',
  accent: '#007aff',
  peerBubble: '#e9e9eb',
  separator: 'rgba(60,60,67,0.12)',
  red: '#ff3b30',
  green: '#34c759',
};

const DN_FONT = '-apple-system, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const DN_FONT_DISPLAY = '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif';
const DN_FONT_MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

function dnShade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function DNImagePlaceholder({ tone, height, rounded = 12, label, fontSize = 10 }) {
  const stripes = `repeating-linear-gradient(135deg, ${tone.bg} 0 14px, ${dnShade(tone.bg, -4)} 14px 28px)`;
  return (
    <div style={{
      width: '100%', height,
      borderRadius: rounded,
      background: stripes,
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      {label && (
        <div style={{
          position: 'absolute', left: 12, bottom: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          color: tone.fg, opacity: 0.55,
          fontFamily: DN_FONT_MONO,
          fontSize, letterSpacing: 0.6,
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: 1,
            background: tone.fg, opacity: 0.7,
          }}/>
          {label}
        </div>
      )}
    </div>
  );
}

// Inline icons used across screens
const DNIcon = {
  back: (color = '#007aff') => (
    <svg width="13" height="22" viewBox="0 0 13 22" fill="none">
      <path d="M11 2L2 11l9 9" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  share: () => (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
      <path d="M10 1v14M5 6l5-5 5 5" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 11v8a2 2 0 002 2h10a2 2 0 002-2v-8" stroke="#007aff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  bookmark: (filled = false) => (
    <svg width="18" height="22" viewBox="0 0 18 22" fill={filled ? '#007aff' : 'none'}>
      <path d="M3 2h12v18l-6-4-6 4V2z" stroke="#007aff" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  ),
  more: () => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9.5" stroke="#007aff" strokeWidth="1.6"/>
      <circle cx="6.5" cy="11" r="1.3" fill="#007aff"/>
      <circle cx="11" cy="11" r="1.3" fill="#007aff"/>
      <circle cx="15.5" cy="11" r="1.3" fill="#007aff"/>
    </svg>
  ),
  attach: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#86868b" strokeWidth="1.8"/>
      <path d="M12 7v10M7 12h10" stroke="#86868b" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  mic: () => (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
      <rect x="7" y="3" width="6" height="12" rx="3" stroke="#86868b" strokeWidth="1.8"/>
      <path d="M3 11a7 7 0 0014 0M10 18v3" stroke="#86868b" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  send: () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#007aff"/>
      <path d="M16 9v14M10 15l6-6 6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  camera: () => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <rect x="2" y="6" width="22" height="16" rx="3" stroke="#86868b" strokeWidth="1.8"/>
      <path d="M9 6l1.5-3h5L17 6" stroke="#86868b" strokeWidth="1.8"/>
      <circle cx="13" cy="14" r="4.2" stroke="#86868b" strokeWidth="1.8"/>
    </svg>
  ),
  chevron: (color = '#c5c5c7') => (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
      <path d="M1 1l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  close: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2L2 12" stroke="#86868b" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  search: (color = '#86868b') => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5.2" stroke={color} strokeWidth="1.7"/>
      <path d="M11 11l3.5 3.5" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  ),
};

// Common large status-bar-aware header (back + actions, no large title)
function DNScreenHeader({ leftLabel, title, rightActions, onBack, sticky = true, dark = false, subtitle }) {
  return (
    <div style={{
      position: sticky ? 'sticky' : 'relative', top: 0, zIndex: 20,
      background: 'rgba(255,255,255,0.86)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderBottom: '0.5px solid rgba(60,60,67,0.18)',
      padding: '8px 8px 10px',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', minHeight: 44,
    }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 8px',
        color: DN_COLORS.accent, fontFamily: DN_FONT,
        fontSize: 17, letterSpacing: -0.4,
        justifySelf: 'start',
      }}>
        {DNIcon.back()} <span>{leftLabel || ''}</span>
      </button>
      <div style={{ textAlign: 'center', justifySelf: 'center' }}>
        <div style={{
          fontFamily: DN_FONT, fontSize: 15, fontWeight: 600,
          color: DN_COLORS.text, letterSpacing: -0.2,
        }}>{title}</div>
        {subtitle && (
          <div style={{
            fontSize: 11, color: DN_COLORS.muted, marginTop: 1,
          }}>{subtitle}</div>
        )}
      </div>
      <div style={{
        justifySelf: 'end',
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 12px',
      }}>
        {rightActions}
      </div>
    </div>
  );
}

window.DN_COLORS = DN_COLORS;
window.DN_FONT = DN_FONT;
window.DN_FONT_DISPLAY = DN_FONT_DISPLAY;
window.DN_FONT_MONO = DN_FONT_MONO;
window.dnShade = dnShade;
window.DNImagePlaceholder = DNImagePlaceholder;
window.DNIcon = DNIcon;
window.DNScreenHeader = DNScreenHeader;
