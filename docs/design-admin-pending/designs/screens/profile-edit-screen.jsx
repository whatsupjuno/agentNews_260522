// ProfileEditScreen + DataDeleteModal
// MVP: 닉네임 즉시 변경, @ID read-only, 데이터 삭제 통합.

const { useState: useStateP, useEffect: useEffectP } = React;

function ProfileEditScreen({ openModal = false }) {
  const [nickname, setNickname] = useStateP('전준규');
  const [status, setStatus] = useStateP('');
  const [showDelete, setShowDelete] = useStateP(openModal);
  useEffectP(() => { setShowDelete(openModal); }, [openModal]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: DN_COLORS.bg,
      position: 'relative', overflow: 'hidden',
      fontFamily: DN_FONT, color: DN_COLORS.text,
    }}>
      <DNScreenHeader leftLabel="설정" title="프로필 편집" rightActions={
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: DN_COLORS.accent, fontFamily: DN_FONT,
          fontSize: 17, fontWeight: 600, padding: '6px 8px',
        }}>저장</button>
      }/>

      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        overflow: 'auto', padding: '20px 16px 28px',
      }}>
        {/* Avatar with camera badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 96, height: 96, borderRadius: 999,
              background: 'linear-gradient(135deg, #c7d2dd 0%, #93a4b6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 32, fontWeight: 600,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>JK</div>
            <button style={{
              position: 'absolute', right: 0, bottom: 0,
              width: 32, height: 32, borderRadius: 999,
              background: DN_COLORS.accent, border: '3px solid #fff',
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,122,255,0.3)',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3.5" width="12" height="8.5" rx="1.6" stroke="#fff" strokeWidth="1.5"/>
                <path d="M5 3.5l0.8-1.5h2.4l0.8 1.5" stroke="#fff" strokeWidth="1.5"/>
                <circle cx="7" cy="8" r="2.3" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Inputs */}
        <Card>
          <RowField label="닉네임" value={nickname} onChange={setNickname} hint="채팅과 페어 화면에 표시됩니다" maxLength={20}/>
          <Separator/>
          <RowField label="사용자 ID" value="@junkyu_2026" hint="구독자 추가 시 검색 키워드. 변경 불가." readOnly/>
          <Separator/>
          <RowField label="상태 메시지" value={status} onChange={setStatus} placeholder="자기소개 한 줄" maxLength={40}/>
        </Card>

        <div style={{
          fontSize: 12, fontWeight: 500, color: DN_COLORS.muted,
          letterSpacing: 0.4, textTransform: 'uppercase',
          marginTop: 28, marginBottom: 8, padding: '0 16px',
        }}>계정</div>
        <Card>
          <ActionRow label="이메일 변경" detail="ju***@daily.com"/>
          <Separator/>
          <ActionRow label="비밀번호 변경"/>
        </Card>

        {/* Danger zone */}
        <div style={{
          fontSize: 12, fontWeight: 500, color: '#ff3b30',
          letterSpacing: 0.4, textTransform: 'uppercase',
          marginTop: 28, marginBottom: 8, padding: '0 16px',
        }}>위험 구역</div>
        <Card>
          <button onClick={() => setShowDelete(true)} style={{
            width: '100%', background: 'none', border: 'none',
            padding: '14px 16px', cursor: 'pointer',
            textAlign: 'left', fontFamily: DN_FONT,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#ff3b30', letterSpacing: -0.2 }}>
                데이터 삭제
              </div>
              <div style={{ fontSize: 12, color: DN_COLORS.muted, marginTop: 2 }}>
                계정 · 메시지 · 첨부 · 구독자 연결 영구 삭제
              </div>
            </div>
            {DNIcon.chevron(DN_COLORS.muted)}
          </button>
        </Card>

        <div style={{
          textAlign: 'center', fontSize: 11, color: DN_COLORS.muted,
          padding: '18px 0 0', letterSpacing: 0.2,
        }}>가입일 · 2026년 3월 12일</div>
      </div>

      {showDelete && <DataDeleteModal onClose={() => setShowDelete(false)}/>}
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>{children}</div>
  );
}

function Separator() {
  return <div style={{ height: 0.5, background: DN_COLORS.separator, marginLeft: 16 }}/>;
}

function RowField({ label, value, onChange, placeholder, hint, readOnly, maxLength }) {
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: DN_COLORS.muted,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>{label}</div>
        {maxLength && (
          <div style={{ fontSize: 11, color: DN_COLORS.muted, fontFamily: DN_FONT_MONO }}>
            {value.length}/{maxLength}
          </div>
        )}
      </div>
      {readOnly ? (
        <div style={{
          marginTop: 6, fontSize: 17, color: DN_COLORS.muted,
          fontFamily: DN_FONT_MONO, letterSpacing: 0.1,
        }}>{value}</div>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          style={{
            marginTop: 4, width: '100%',
            border: 'none', outline: 'none', background: 'transparent',
            fontFamily: DN_FONT, fontSize: 17,
            color: DN_COLORS.text, letterSpacing: -0.2,
            padding: 0,
          }}
        />
      )}
      {hint && (
        <div style={{
          fontSize: 12, color: DN_COLORS.muted,
          marginTop: 4, letterSpacing: -0.1,
        }}>{hint}</div>
      )}
    </div>
  );
}

function ActionRow({ label, detail }) {
  return (
    <div style={{
      padding: '14px 16px', minHeight: 44,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer',
    }}>
      <div style={{ fontSize: 16, fontWeight: 400, color: DN_COLORS.text, letterSpacing: -0.2 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {detail && <span style={{ color: DN_COLORS.muted, fontSize: 15 }}>{detail}</span>}
        {DNIcon.chevron(DN_COLORS.muted)}
      </div>
    </div>
  );
}

// ─── Data Delete Modal ─────────────────────────────────────────────────────
function DataDeleteModal({ onClose }) {
  const [text, setText] = useStateP('');
  const armed = text.trim() === '삭제';
  const [submitting, setSubmitting] = useStateP(false);

  const submit = () => {
    if (!armed) return;
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); onClose?.(); }, 1200);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 60,
      display: 'flex', alignItems: 'flex-end',
      animation: 'dn-fade-in 220ms ease',
    }}>
      <div style={{
        background: '#fff',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        width: '100%', maxHeight: '88%', overflowY: 'auto',
        boxShadow: '0 -12px 36px rgba(0,0,0,0.18)',
        animation: 'dn-sheet-up 320ms cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        {/* Red header */}
        <div style={{
          background: '#ff3b30',
          padding: '24px 24px 32px',
          color: '#fff',
          textAlign: 'center',
          position: 'relative',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 999,
            background: 'rgba(255,255,255,0.22)',
            margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 700, color: '#fff',
            fontFamily: DN_FONT_DISPLAY,
          }}>!</div>
          <div style={{
            fontFamily: DN_FONT_DISPLAY,
            fontSize: 22, fontWeight: 700, letterSpacing: -0.4,
            color: '#fff', textWrap: 'pretty',
          }}>
            모든 데이터를 삭제하시겠어요?
          </div>
          <div style={{
            fontSize: 13.5, color: 'rgba(255,255,255,0.92)',
            marginTop: 6, lineHeight: 1.5,
          }}>이 작업은 되돌릴 수 없습니다.</div>
        </div>

        {/* Warning list */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: 1.4,
            color: DN_COLORS.muted, textTransform: 'uppercase',
            marginBottom: 10,
          }}>삭제되는 항목</div>
          {[
            { icon: '👤', label: '계정 정보 (이메일, 닉네임, 사용자 ID)' },
            { icon: '💬', label: '구독자와의 모든 메시지' },
            { icon: '📎', label: '첨부 파일 (사진, PDF) 전체' },
            { icon: '🔗', label: '구독자 연결 자동 해제 (상대도 알림 수신)' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '0.5px solid ' + DN_COLORS.separator,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: '#fff5f4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>{item.icon}</div>
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, color: DN_COLORS.text, paddingTop: 4 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Confirm input */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{
            fontSize: 13, color: DN_COLORS.text,
            marginBottom: 8, lineHeight: 1.5,
          }}>
            계속하려면 아래 칸에 <b>삭제</b> 라고 입력하세요.
          </div>
          <div style={{
            background: '#f5f5f7',
            border: '0.5px solid ' + (armed ? '#ff3b30' : 'rgba(60,60,67,0.18)'),
            borderRadius: 12,
            padding: '12px 14px',
            transition: 'border-color 120ms',
          }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="삭제"
              style={{
                width: '100%', border: 'none', outline: 'none',
                background: 'transparent',
                fontFamily: DN_FONT, fontSize: 17,
                color: DN_COLORS.text, letterSpacing: -0.2,
              }}
            />
          </div>
          {armed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 6, fontSize: 12, color: '#28a745',
              fontWeight: 500,
            }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 999, background: '#28a745' }}/>
              확인 완료
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '20px 24px 32px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <button
            disabled={!armed || submitting}
            onClick={submit}
            style={{
              width: '100%', padding: '14px',
              background: armed && !submitting ? '#ff3b30' : '#fde2e0',
              color: armed && !submitting ? '#fff' : '#d9a59f',
              border: 'none', borderRadius: 12,
              fontFamily: DN_FONT, fontSize: 17, fontWeight: 600,
              letterSpacing: -0.2,
              cursor: armed && !submitting ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 120ms',
            }}>
            {submitting && (
              <span style={{
                width: 18, height: 18, borderRadius: 999,
                border: '2.5px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                animation: 'dn-spin 0.8s linear infinite',
                display: 'inline-block',
              }}/>
            )}
            {submitting ? '삭제 중...' : '데이터 영구 삭제'}
          </button>
          <button onClick={onClose} style={{
            width: '100%', padding: '12px',
            background: 'transparent', border: 'none',
            color: DN_COLORS.accent,
            fontFamily: DN_FONT, fontSize: 17, fontWeight: 500,
            cursor: 'pointer',
          }}>취소</button>
        </div>
      </div>
    </div>
  );
}

window.ProfileEditScreen = ProfileEditScreen;
window.DataDeleteModal = DataDeleteModal;
