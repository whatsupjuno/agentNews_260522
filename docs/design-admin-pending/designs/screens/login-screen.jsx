// LoginScreen — basic / error / loading
// Disguise: ordinary news-app login. zero chat/secret vocabulary.

const { useState } = React;

function LoginScreen({ state = 'basic' }) {
  // state: 'basic' | 'error' | 'loading'
  const [email, setEmail] = useState(state === 'basic' ? '' : 'jun@daily.com');
  const [pw, setPw] = useState(state === 'basic' ? '' : '••••••••••');
  const errored = state === 'error';
  const loading = state === 'loading';

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fff', position: 'relative',
      fontFamily: DN_FONT, color: DN_COLORS.text,
      WebkitFontSmoothing: 'antialiased',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* upper logo block */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 32px 24px' }}>
        <div style={{ marginBottom: 56, textAlign: 'center' }}>
          {/* Newspaper "N" mark */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(140deg, #ffffff 0%, #f0f0f3 100%)',
            margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.10), inset 0 0 0 0.5px rgba(0,0,0,0.06)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontWeight: 900, fontSize: 38, lineHeight: 1,
              color: DN_COLORS.text, letterSpacing: -2,
            }}>N</div>
            <div style={{ position: 'absolute', left: '14%', right: '14%', bottom: '20%', height: 1.5, background: DN_COLORS.text, opacity: 0.6 }}/>
            <div style={{ position: 'absolute', left: '20%', right: '20%', bottom: '14%', height: 1.5, background: DN_COLORS.text, opacity: 0.4 }}/>
          </div>
          <div style={{
            fontFamily: DN_FONT_DISPLAY,
            fontSize: 30, fontWeight: 800, letterSpacing: -1,
            color: DN_COLORS.text, lineHeight: 1,
          }}>DailyNews</div>
          <div style={{
            fontSize: 14, color: DN_COLORS.muted,
            marginTop: 8, letterSpacing: -0.1,
          }}>매일의 뉴스를 한 곳에서</div>
        </div>
      </div>

      {/* form block */}
      <div style={{ padding: '0 24px 32px', flex: 1.2 }}>
        <FormField
          label="이메일"
          value={email}
          onChange={setEmail}
          placeholder="example@daily.com"
          error={errored ? '이메일 또는 비밀번호가 올바르지 않습니다' : null}
          showErrorBelow={false}
          disabled={loading}
        />
        <FormField
          label="비밀번호"
          value={pw}
          onChange={setPw}
          placeholder="비밀번호"
          type="password"
          error={errored ? ' ' : null}
          showErrorBelow={true}
          errorText={errored ? '이메일 또는 비밀번호가 올바르지 않습니다' : null}
          disabled={loading}
        />

        {/* CTA */}
        <button disabled={loading} style={{
          width: '100%', marginTop: 24,
          padding: '14px',
          background: loading ? '#7eb0f7' : DN_COLORS.accent,
          color: '#fff', border: 'none', borderRadius: 12,
          fontFamily: DN_FONT, fontSize: 17, fontWeight: 600,
          letterSpacing: -0.2,
          cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {loading && (
            <span style={{
              width: 18, height: 18, borderRadius: 999,
              border: '2.5px solid rgba(255,255,255,0.35)',
              borderTopColor: '#fff',
              animation: 'dn-spin 0.8s linear infinite',
              display: 'inline-block',
            }}/>
          )}
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 18,
          fontSize: 14, letterSpacing: -0.1,
        }}>
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: DN_FONT, fontSize: 14,
            color: DN_COLORS.muted, padding: 0,
          }}>비밀번호 찾기</button>
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: DN_FONT, fontSize: 14, fontWeight: 600,
            color: DN_COLORS.accent, padding: 0,
          }}>회원가입</button>
        </div>
      </div>
    </div>
  );
}

// Reusable form field
function FormField({ label, value, onChange, placeholder, type = 'text', error, showErrorBelow, errorText, disabled, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: DN_COLORS.muted,
        letterSpacing: 0.5, textTransform: 'uppercase',
        marginBottom: 6, paddingLeft: 4,
      }}>{label}</div>
      <div style={{
        background: '#f5f5f7',
        border: '0.5px solid ' + (
          error ? '#ff3b30' :
          focused ? DN_COLORS.accent :
          'rgba(60,60,67,0.18)'
        ),
        borderRadius: 12,
        padding: '11px 14px',
        boxShadow: focused && !error ? '0 0 0 3px rgba(0,122,255,0.12)' :
                   error ? '0 0 0 3px rgba(255,59,48,0.10)' : 'none',
        transition: 'all 120ms',
      }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%', border: 'none', outline: 'none', background: 'transparent',
            fontFamily: DN_FONT, fontSize: 17, color: DN_COLORS.text,
            letterSpacing: -0.2,
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>
      {showErrorBelow && errorText && (
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: '#ff3b30',
          marginTop: 6, paddingLeft: 4,
          letterSpacing: -0.1,
        }}>{errorText}</div>
      )}
      {hint && !errorText && (
        <div style={{
          fontSize: 12, fontWeight: 400,
          color: DN_COLORS.muted,
          marginTop: 6, paddingLeft: 4,
        }}>{hint}</div>
      )}
    </div>
  );
}

window.LoginScreen = LoginScreen;
window.FormField = FormField;
