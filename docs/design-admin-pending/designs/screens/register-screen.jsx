// RegisterScreen — 4 validation states
// state: 'empty' | 'err-email' | 'err-id' | 'err-pw' | 'err-mismatch' | 'valid'
// 사용자 ID 규칙: 10자 이내, 영문/숫자/한글 (regex: /^[a-zA-Z0-9가-힣]{1,10}$/)

const { useState: useStateR } = React;

function RegisterScreen({ state = 'empty' }) {
  // Pre-fill values based on the validation scenario we want to show
  const scenarios = {
    'empty':        { email: '',                  id: '',         pw: '',         pw2: '',         err: 'email' },
    'err-email':    { email: 'jun@daily',         id: '준규',       pw: '12345678', pw2: '12345678', err: 'email' },
    'err-id':       { email: 'jun@daily.com',     id: 'jun_2026', pw: '12345678', pw2: '12345678', err: 'id' },      // underscore 포함 → fail
    'err-pw':       { email: 'jun@daily.com',     id: '준규',       pw: '12345',    pw2: '12345',    err: 'pw' },
    'err-mismatch': { email: 'jun@daily.com',     id: '준규',       pw: '12345678', pw2: '87654321', err: 'mismatch' },
    'valid':        { email: 'jun@daily.com',     id: '준규',       pw: '12345678', pw2: '12345678', err: null },
  };
  const s = scenarios[state] || scenarios.empty;

  const errors = state === 'empty' ? {} : {
    email: s.err === 'email' ? '올바른 이메일 형식이 아닙니다' : null,
    id:    s.err === 'id'    ? '10자 이내, 영문/숫자/한글' : null,
    pw:    s.err === 'pw'    ? '비밀번호는 8자 이상이어야 합니다' : null,
    pw2:   s.err === 'mismatch' ? '비밀번호가 일치하지 않습니다' : null,
  };

  const ctaEnabled = state === 'valid';

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fff',
      position: 'relative', overflow: 'hidden',
      fontFamily: DN_FONT, color: DN_COLORS.text,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <DNScreenHeader leftLabel="" title="회원가입"/>

      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        overflow: 'auto', padding: '20px 24px 28px',
      }}>
        <div style={{
          fontFamily: DN_FONT_DISPLAY,
          fontSize: 24, fontWeight: 700, letterSpacing: -0.5,
          color: DN_COLORS.text, marginBottom: 6,
        }}>계정 만들기</div>
        <div style={{
          fontSize: 14, color: DN_COLORS.muted,
          marginBottom: 20, letterSpacing: -0.1,
        }}>DailyNews 에서 매일의 헤드라인을 받아보세요</div>

        <FormField
          label="이메일"
          value={s.email}
          onChange={() => {}}
          placeholder="example@daily.com"
          error={errors.email}
          showErrorBelow={true}
          errorText={errors.email}
        />

        <FormField
          label="사용자 ID"
          value={s.id}
          onChange={() => {}}
          placeholder="10자 이내, 영문/숫자/한글"
          error={errors.id}
          showErrorBelow={true}
          errorText={errors.id}
          hint={!errors.id ? "구독자 추가 시 검색 키워드로 사용됩니다" : null}
        />

        <FormField
          label="비밀번호"
          value={s.pw}
          onChange={() => {}}
          placeholder="8자 이상"
          type="password"
          error={errors.pw}
          showErrorBelow={true}
          errorText={errors.pw}
          hint={!errors.pw ? "최소 8자, 영문 + 숫자 조합 권장" : null}
        />

        <FormField
          label="비밀번호 확인"
          value={s.pw2}
          onChange={() => {}}
          placeholder="비밀번호 다시 입력"
          type="password"
          error={errors.pw2}
          showErrorBelow={true}
          errorText={errors.pw2}
        />

        {/* Terms */}
        <div style={{
          fontSize: 12, color: DN_COLORS.muted,
          marginTop: 8, marginBottom: 18, lineHeight: 1.55,
          padding: '0 4px', textAlign: 'center',
        }}>
          계정을 만들면 <span style={{ color: DN_COLORS.accent, textDecoration: 'underline' }}>이용약관</span> 및{' '}
          <span style={{ color: DN_COLORS.accent, textDecoration: 'underline' }}>개인정보 처리방침</span> 에 동의하는 것으로 간주됩니다.
        </div>

        {/* CTA */}
        <button disabled={!ctaEnabled} style={{
          width: '100%', padding: '14px',
          background: ctaEnabled ? DN_COLORS.accent : '#e5e5ea',
          color: ctaEnabled ? '#fff' : '#86868b',
          border: 'none', borderRadius: 12,
          fontFamily: DN_FONT, fontSize: 17, fontWeight: 600,
          letterSpacing: -0.2,
          cursor: ctaEnabled ? 'pointer' : 'default',
          transition: 'background 120ms',
        }}>회원가입</button>

        <div style={{
          marginTop: 18, textAlign: 'center',
          fontSize: 14, color: DN_COLORS.muted,
        }}>
          이미 계정이 있으신가요? <span style={{
            color: DN_COLORS.accent, fontWeight: 600, marginLeft: 4,
          }}>로그인</span>
        </div>
      </div>
    </div>
  );
}

window.RegisterScreen = RegisterScreen;
