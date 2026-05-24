// SettingsScreen + SequenceChange modal
// Disguise: "콘텐츠 잠금" / "잠금 해제 도움말" — no "시퀀스/secret" vocabulary externally.
// Internally we still call it sequence in code comments only.

const { useState } = React;

function SettingsScreen({ openModal: openModalProp }) {
  const [showModal, setShowModal] = useState(false);
  const open = openModalProp !== undefined ? openModalProp : showModal;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: DN_COLORS.bg,
      position: 'relative', overflow: 'hidden',
      fontFamily: DN_FONT, color: DN_COLORS.text,
    }}>
      <DNScreenHeader
        leftLabel="피드"
        title="설정"
      />

      <div style={{ height: 'calc(100% - 56px)', overflowY: 'auto', paddingBottom: 30 }}>
        {/* Profile card */}
        <div style={{ padding: '16px 16px 8px' }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999,
              background: 'linear-gradient(135deg, #c7d2dd, #93a4b6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 600,
            }}>JK</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>
                전준규
              </div>
              <div style={{
                fontFamily: DN_FONT_MONO, fontSize: 12,
                color: DN_COLORS.muted, marginTop: 2,
              }}>@junkyu_2026</div>
              <div style={{
                marginTop: 6, display: 'inline-flex',
                gap: 6, alignItems: 'center',
                background: '#e7f7ec', color: '#28a745',
                fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
                textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 999,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: '#28a745' }}/>
                구독자 1명과 연결됨
              </div>
            </div>
            {DNIcon.chevron(DN_COLORS.muted)}
          </div>
        </div>

        <Group header="계정">
          <Row icon="✎" iconBg="#8e8e93" label="프로필 편집"/>
          <Row icon="🔒" iconBg="#5856d6" label="비밀번호 변경"/>
          <Row icon="📩" iconBg="#34c759" label="이메일 변경" detail="ju***@daily.com"/>
        </Group>

        <Group header="콘텐츠">
          <Row icon="◐" iconBg="#1d1d1f" label="콘텐츠 잠금 코드"
               detail="활성"
               onTap={() => setShowModal(true)}/>
          <Row icon="?" iconBg="#ff9500" label="잠금 해제 도움말"/>
          <Row icon="✦" iconBg="#af52de" label="구독자 관리"/>
          <Row icon="✕" iconBg="#86868b" label="구독자 해제" last/>
        </Group>

        <Group header="앱">
          <Row icon="🔔" iconBg="#ff453a" label="알림" detail="켜짐"/>
          <Row icon="◑" iconBg="#5ac8fa" label="다크 모드" detail="시스템"/>
          <Row icon="ⓘ" iconBg="#8e8e93" label="버전 정보" detail="2.4.1 (build 312)" chevron={false} last/>
        </Group>

        <Group>
          <Row label="로그아웃" danger center last/>
        </Group>

        <Group>
          <Row label="회원 탈퇴" danger center last/>
        </Group>

        <div style={{
          textAlign: 'center', fontSize: 11, color: DN_COLORS.muted,
          padding: '16px 0 8px', letterSpacing: 0.2,
        }}>DailyNews · 2.4.1 (build 312)</div>
      </div>

      {open && <SequenceChangeModal onClose={() => setShowModal(false)}/>}
    </div>
  );
}

function Group({ header, children }) {
  return (
    <div style={{ marginTop: 24 }}>
      {header && (
        <div style={{
          fontSize: 12, fontWeight: 500, letterSpacing: 0.3,
          color: DN_COLORS.muted, textTransform: 'uppercase',
          padding: '0 32px 6px',
        }}>{header}</div>
      )}
      <div style={{
        background: '#fff', margin: '0 16px', borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {children}
      </div>
    </div>
  );
}

function Row({ icon, iconBg, label, detail, chevron = true, last, danger, center, onTap }) {
  return (
    <div onClick={onTap} style={{
      padding: '12px 14px',
      minHeight: 44,
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'relative',
      cursor: onTap ? 'pointer' : 'default',
    }}>
      {icon && (
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: iconBg,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, flexShrink: 0,
          fontFamily: DN_FONT_DISPLAY,
        }}>{icon}</div>
      )}
      <div style={{
        flex: 1,
        fontSize: 16, fontWeight: 400, letterSpacing: -0.2,
        color: danger ? '#ff453a' : DN_COLORS.text,
        textAlign: center ? 'center' : 'left',
      }}>{label}</div>
      {detail && <span style={{ color: DN_COLORS.muted, fontSize: 15 }}>{detail}</span>}
      {chevron && !center && !danger && DNIcon.chevron(DN_COLORS.muted)}
      {!last && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          left: icon ? 56 : 14,
          height: 0.5, background: DN_COLORS.separator,
        }}/>
      )}
    </div>
  );
}

// ─── Sequence Change Modal ─────────────────────────────────────────────────
function SequenceChangeModal({ onClose }) {
  const [taps, setTaps] = useState([]); // array of article positions (1-7)
  const [confirmed, setConfirmed] = useState(false);

  const onTapArticle = (pos) => {
    if (confirmed) return;
    if (taps.length >= 4) return;
    if (taps.includes(pos)) return; // each position used once
    setTaps([...taps, pos]);
  };

  const reset = () => { setTaps([]); setConfirmed(false); };
  const complete = taps.length === 4;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 50,
      display: 'flex', alignItems: 'flex-end',
      animation: 'dn-fade-in 220ms ease',
    }}>
      <div style={{
        background: '#fff',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        width: '100%', maxHeight: '92%', overflowY: 'auto',
        boxShadow: '0 -12px 36px rgba(0,0,0,0.18)',
        animation: 'dn-sheet-up 320ms cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        {/* grabber */}
        <div style={{
          width: 36, height: 5, borderRadius: 999,
          background: 'rgba(0,0,0,0.2)',
          margin: '8px auto 0',
        }}/>

        {/* header */}
        <div style={{
          padding: '20px 20px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: DN_FONT, fontSize: 17, color: DN_COLORS.accent,
            padding: 0,
          }}>취소</button>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>
            콘텐츠 잠금 코드
          </div>
          <button disabled={!confirmed} style={{
            background: 'none', border: 'none',
            cursor: confirmed ? 'pointer' : 'default',
            fontFamily: DN_FONT, fontSize: 17, fontWeight: 600,
            color: confirmed ? DN_COLORS.accent : '#c5c5c7',
            padding: 0,
          }}>저장</button>
        </div>

        {/* explainer */}
        <div style={{ padding: '0 24px 16px', textAlign: 'center' }}>
          <div style={{
            fontFamily: DN_FONT_DISPLAY, fontSize: 22, fontWeight: 700,
            letterSpacing: -0.4, color: DN_COLORS.text,
            marginBottom: 8,
          }}>
            새로운 잠금 순서를 설정하세요
          </div>
          <div style={{
            fontSize: 14, lineHeight: 1.5, color: '#515154',
          }}>
            피드의 카드 4장을 원하는 순서로 탭하세요. <br/>
            잠금 해제 시 같은 순서로 입력해야 합니다.
          </div>
        </div>

        {/* tap progress */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 12,
          padding: '8px 0 18px',
        }}>
          {[0,1,2,3].map(i => {
            const filled = i < taps.length;
            return (
              <div key={i} style={{
                width: 44, height: 44, borderRadius: 12,
                background: filled ? DN_COLORS.text : '#f1f1f3',
                color: filled ? '#fff' : '#c5c5c7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: DN_FONT_DISPLAY, fontSize: 19, fontWeight: 700,
                transition: 'background 150ms',
              }}>
                {filled ? taps[i] : i + 1}
              </div>
            );
          })}
        </div>

        {/* article grid */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: DN_COLORS.muted, textTransform: 'uppercase',
            marginBottom: 8, padding: '0 4px',
          }}>오늘의 헤드라인</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
          }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const pos = i + 1;
              const isSelected = taps.includes(pos);
              const tapOrder = taps.indexOf(pos) + 1;
              const tones = [
                {bg:'#dbe5d3',fg:'#3a4530'}, {bg:'#dde4ec',fg:'#2b3a4a'},
                {bg:'#d3dde6',fg:'#27384a'}, {bg:'#e7ddea',fg:'#42304a'},
                {bg:'#ece2d1',fg:'#4a3f28'}, {bg:'#ecdcd6',fg:'#4a2f28'},
                {bg:'#d8e0db',fg:'#2c3a33'},
              ];
              return (
                <button key={pos} onClick={() => onTapArticle(pos)} style={{
                  border: 'none', padding: 0, cursor: confirmed ? 'default' : 'pointer',
                  background: '#fff',
                  borderRadius: 10, overflow: 'hidden',
                  textAlign: 'left',
                  position: 'relative',
                  outline: isSelected ? `2px solid ${DN_COLORS.accent}` : 'none',
                  outlineOffset: -2,
                  transition: 'transform 120ms',
                  gridColumn: pos === 1 ? 'span 2' : 'auto',
                }}>
                  <DNImagePlaceholder
                    tone={tones[i]}
                    height={pos === 1 ? 110 : 70}
                    rounded={10}
                  />
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                    padding: '2px 7px', borderRadius: 6,
                  }}>#{pos}</div>
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 28, height: 28, borderRadius: 999,
                      background: DN_COLORS.accent, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700,
                      boxShadow: '0 2px 6px rgba(0,122,255,0.4)',
                    }}>{tapOrder}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* action buttons */}
        <div style={{
          padding: '0 16px 28px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {!confirmed && (
            <>
              <button
                onClick={() => complete && setConfirmed(true)}
                disabled={!complete}
                style={{
                  width: '100%', padding: '14px',
                  background: complete ? DN_COLORS.text : '#e5e5ea',
                  color: complete ? '#fff' : '#86868b',
                  border: 'none', borderRadius: 14,
                  fontFamily: DN_FONT, fontSize: 17, fontWeight: 600,
                  cursor: complete ? 'pointer' : 'default',
                }}>다음</button>
              <button onClick={reset} style={{
                width: '100%', padding: '12px',
                background: 'transparent', border: 'none',
                color: DN_COLORS.accent,
                fontFamily: DN_FONT, fontSize: 15, fontWeight: 500,
                cursor: 'pointer',
              }}>처음부터 다시</button>
            </>
          )}
          {confirmed && (
            <div style={{
              background: '#e7f7ec', borderRadius: 14, padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1e7a35' }}>
                순서 확인 완료 — {taps.join(' → ')}
              </div>
              <div style={{ fontSize: 12, color: '#1e7a35', marginTop: 4, opacity: 0.85 }}>
                "저장" 을 눌러 새 잠금 코드를 적용하세요.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
window.SequenceChangeModal = SequenceChangeModal;
