// ArticleDetailScreen — covers normal article view AND the chat-swap mode.
// The swap is conditional on `localStorage.dn_unlock === '1'` + paired state.
// Header chrome stays identical between modes to preserve disguise; the only
// visible signal is the small "기사 토론 · N개의 댓글" subtitle.

const { useState, useEffect, useRef } = React;

// ─── Article content (the "5번" article from feed used for demo) ───────────
const DEMO_ARTICLE = {
  id: 5,
  category: 'URBAN',
  categoryKr: '사회',
  title: '도시 재생 프로젝트, 폐공장이 복합문화공간으로',
  deck: '서울 영등포구의 1970년대 제지공장이 시민이 운영하는 복합문화공간으로 재탄생했다. 5년간의 협업 과정과 운영 모델을 들여다봤다.',
  source: '어반저널',
  author: '김지윤 기자',
  publishedAt: '2026년 5월 20일 오전 11:42',
  tone: { bg: '#ece2d1', fg: '#4a3f28', label: 'URBAN' },
  paragraphs: [
    '문이 닫힌 지 12년이 된 폐공장의 정문이 다시 열렸다. 5월 18일, 영등포 옛 동방제지공장 부지에 들어선 "당산창고"의 개관 행사에는 인근 주민 800여 명이 참석했다.',
    '4,200평 규모의 부지는 전시장·공방·청년 창업 사무실·옥상정원으로 재구성됐다. 운영은 인근 5개 동(洞) 주민이 공동으로 설립한 협동조합이 맡는다. 서울시는 5년간 운영비의 30%를 보조하되, 6년 차부터는 자립을 요구한다.',
    '"리모델링이 아니라 재해석에 가깝다"고 총괄 건축가 한지원 씨는 말했다. 콘크리트 구조체와 천창은 그대로 살리고, 내부에 가벼운 목구조 모듈을 끼워 넣는 방식이다.',
    '비슷한 유휴 산업시설 재생 프로젝트는 전국에 23곳이 진행 중이며, 그 중 7곳이 올해 안에 개관을 앞두고 있다.',
  ],
  related: [
    { tone: 'TECH',   title: '도시 데이터 플랫폼, 자치구별 격차 분석' },
    { tone: 'URBAN',  title: '옥상정원 의무화 조례, 5개 시 도입 검토' },
  ],
};

// ─── Mock messages (8 exchanges, disguised — no agent vocabulary) ──────────
const DEMO_MESSAGES = [
  { id: 1, from: 'peer', t: '11:48', text: '어제 보낸 기획안 봤어?' },
  { id: 2, from: 'peer', t: '11:48', text: '시간 되면 의견 좀 줘' },
  { id: 3, from: 'me',   t: '11:51', text: '응, 다 읽었어. 방향성은 좋더라' },
  { id: 4, from: 'me',   t: '11:51', text: '근데 3번 섹션이 좀 약한 것 같아' },
  { id: 5, from: 'peer', t: '11:54', text: '오 그래? 어떤 부분이?' },
  { id: 6, from: 'peer', t: '11:55', attachment: { kind: 'image', tone: { bg:'#d3dde6', fg:'#27384a' }, name: 'reference-board.png', w: 220, h: 160 } },
  { id: 7, from: 'me',   t: '11:57', text: '데이터 근거가 1개 출처뿐이야. 보완 필요할 듯' },
  { id: 8, from: 'me',   t: '11:57', text: '내일 카페에서 같이 볼래? 10시쯤' },
];

// ─── Normal article body ───────────────────────────────────────────────────
function ArticleBody({ article }) {
  return (
    <>
      <DNImagePlaceholder tone={article.tone} height={260} rounded={0} label="ARTICLE HERO 16:9" fontSize={11}/>

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1.6,
          color: DN_COLORS.accent, textTransform: 'uppercase', marginBottom: 12,
        }}>
          {article.category} · {article.categoryKr}
        </div>
        <h1 style={{
          fontFamily: DN_FONT_DISPLAY,
          fontSize: 28, fontWeight: 800, lineHeight: 1.18,
          letterSpacing: -0.6, color: DN_COLORS.text,
          margin: 0, textWrap: 'pretty',
        }}>{article.title}</h1>
        <p style={{
          fontSize: 16, lineHeight: 1.5, color: '#3a3a3c',
          margin: '14px 0 0', textWrap: 'pretty',
        }}>{article.deck}</p>

        {/* byline */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 0 16px',
          borderBottom: '0.5px solid ' + DN_COLORS.separator,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 999,
            background: 'linear-gradient(135deg, #d8d5cf, #b8b4ac)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>김</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: DN_COLORS.text }}>
              {article.source} · {article.author}
            </div>
            <div style={{ fontSize: 12, color: DN_COLORS.muted, marginTop: 1 }}>
              {article.publishedAt}
            </div>
          </div>
          <button style={{
            background: '#f5f5f7', border: 'none',
            padding: '7px 14px', borderRadius: 999,
            fontSize: 13, fontWeight: 600, color: DN_COLORS.text,
            cursor: 'pointer', fontFamily: DN_FONT,
          }}>+ 팔로우</button>
        </div>

        {/* body paragraphs */}
        <div style={{
          fontSize: 16, lineHeight: 1.62, color: '#1d1d1f',
          textWrap: 'pretty', paddingTop: 14,
        }}>
          {article.paragraphs.map((p, i) => (
            <p key={i} style={{ margin: '0 0 14px', textIndent: i === 0 ? 0 : 0 }}>
              {i === 0 && (
                <span style={{
                  float: 'left',
                  fontFamily: DN_FONT_DISPLAY,
                  fontSize: 46, lineHeight: 0.9, fontWeight: 700,
                  paddingRight: 8, paddingTop: 4, color: DN_COLORS.text,
                }}>{p.charAt(0)}</span>
              )}
              {i === 0 ? p.slice(1) : p}
            </p>
          ))}
        </div>

        {/* read original CTA */}
        <button style={{
          width: '100%', marginTop: 6,
          background: '#f5f5f7', border: 'none',
          padding: '14px 16px', borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: DN_FONT, fontSize: 15, fontWeight: 500,
          color: DN_COLORS.text, cursor: 'pointer',
        }}>
          <span>어반저널에서 원문 보기</span>
          {DNIcon.chevron(DN_COLORS.muted)}
        </button>

        {/* related */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
          color: DN_COLORS.muted, textTransform: 'uppercase',
          marginTop: 28, marginBottom: 10,
        }}>관련 기사</div>
        {article.related.map((r, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '12px 0',
            borderTop: i === 0 ? 'none' : '0.5px solid ' + DN_COLORS.separator,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8,
                color: DN_COLORS.muted, marginBottom: 4,
              }}>{r.tone}</div>
              <div style={{
                fontSize: 15, fontWeight: 600, lineHeight: 1.3,
                color: DN_COLORS.text, textWrap: 'pretty',
              }}>{r.title}</div>
            </div>
            <div style={{ width: 64, flexShrink: 0 }}>
              <DNImagePlaceholder
                tone={r.tone === 'TECH'
                  ? { bg:'#d3dde6', fg:'#27384a' }
                  : { bg:'#ece2d1', fg:'#4a3f28' }}
                height={64} rounded={8} />
            </div>
          </div>
        ))}

        <div style={{ height: 24 }}/>
      </div>
    </>
  );
}

// ─── Chat-swap body ────────────────────────────────────────────────────────
function MessageBubble({ msg, prev, next }) {
  const isMe = msg.from === 'me';
  const groupedAbove = prev && prev.from === msg.from;
  const groupedBelow = next && next.from === msg.from;

  // corner radius pattern: pinch the corner facing the prev/next bubble
  const tail = 22, pinch = 6;
  const radius = isMe
    ? `${tail}px ${groupedAbove ? pinch : tail}px ${groupedBelow ? pinch : tail}px ${tail}px`
    : `${groupedAbove ? pinch : tail}px ${tail}px ${tail}px ${groupedBelow ? pinch : tail}px`;

  const bg = isMe ? DN_COLORS.accent : DN_COLORS.peerBubble;
  const fg = isMe ? '#fff' : DN_COLORS.text;

  return (
    <div style={{
      display: 'flex',
      justifyContent: isMe ? 'flex-end' : 'flex-start',
      marginTop: groupedAbove ? 2 : 8,
    }}>
      <div style={{
        maxWidth: '74%',
        background: bg, color: fg,
        padding: msg.attachment ? 4 : '8px 14px 9px',
        borderRadius: radius,
        fontFamily: DN_FONT, fontSize: 16, lineHeight: 1.32,
        letterSpacing: -0.2,
        wordBreak: 'break-word',
      }}>
        {msg.attachment ? (
          <div>
            <div style={{
              borderRadius: 18, overflow: 'hidden',
              width: msg.attachment.w, height: msg.attachment.h,
            }}>
              <DNImagePlaceholder
                tone={msg.attachment.tone}
                height={msg.attachment.h}
                rounded={18}
                label="ATTACHMENT"
              />
            </div>
          </div>
        ) : (
          msg.text
        )}
      </div>
    </div>
  );
}

function ChatInputBar({ value, setValue, onSend }) {
  const inputRef = useRef(null);
  const empty = !value.trim();
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 30, paddingTop: 8,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderTop: '0.5px solid ' + DN_COLORS.separator,
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '8px 12px 30px',
      zIndex: 30,
    }}>
      <button style={{
        background: '#f1f1f3', border: 'none',
        width: 36, height: 36, borderRadius: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
      }}>{DNIcon.attach()}</button>
      <button style={{
        background: '#f1f1f3', border: 'none',
        width: 36, height: 36, borderRadius: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
      }}>{DNIcon.camera()}</button>
      <div style={{
        flex: 1,
        background: '#fff',
        borderRadius: 22,
        border: '0.5px solid rgba(60,60,67,0.18)',
        padding: '7px 12px',
        minHeight: 36,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !empty) { onSend(); e.preventDefault(); } }}
          placeholder="댓글 입력"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent',
            fontFamily: DN_FONT, fontSize: 16, color: DN_COLORS.text,
            letterSpacing: -0.2, minWidth: 0,
          }}
        />
        {empty && (
          <span style={{ flexShrink: 0, opacity: 0.85 }}>{DNIcon.mic()}</span>
        )}
      </div>
      {!empty && (
        <button onClick={onSend} style={{
          background: 'none', border: 'none', padding: 0,
          width: 32, height: 32, cursor: 'pointer', flexShrink: 0,
        }}>{DNIcon.send()}</button>
      )}
    </div>
  );
}

function ChatBody() {
  const [messages, setMessages] = useState(DEMO_MESSAGES);
  const [text, setText] = useState('');
  const scrollerRef = useRef(null);

  useEffect(() => {
    // scroll to bottom on mount + new message
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    const now = new Date();
    const t = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    setMessages((m) => [...m, { id: Date.now(), from: 'me', t, text: text.trim() }]);
    setText('');
  };

  return (
    <>
      <div
        ref={scrollerRef}
        style={{
          height: '100%', overflowY: 'auto',
          padding: '12px 14px 120px',
          background: '#fff',
        }}
      >
        {/* disguised pinned context */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12,
          background: '#f5f5f7', marginBottom: 16,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <DNImagePlaceholder tone={DEMO_ARTICLE.tone} height={40} rounded={8}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: 1,
              color: DN_COLORS.muted, textTransform: 'uppercase',
            }}>토론 중인 기사</div>
            <div style={{
              fontSize: 13, fontWeight: 600, color: DN_COLORS.text,
              marginTop: 2, lineHeight: 1.25,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>{DEMO_ARTICLE.title}</div>
          </div>
        </div>

        <div style={{
          textAlign: 'center', fontSize: 11, color: DN_COLORS.muted,
          margin: '0 0 12px', letterSpacing: 0.2,
        }}>오늘 오전 11:48</div>

        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            msg={m}
            prev={messages[i - 1]}
            next={messages[i + 1]}
          />
        ))}
      </div>

      <ChatInputBar value={text} setValue={setText} onSend={send}/>
    </>
  );
}

// ─── Main screen with conditional swap ─────────────────────────────────────
function ArticleDetailScreen({ forceMode }) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (forceMode === 'chat') { setUnlocked(true); return; }
    if (forceMode === 'normal') { setUnlocked(false); return; }
    try { setUnlocked(localStorage.getItem('dn_unlock') === '1'); } catch {}
    const onStorage = () => {
      try { setUnlocked(localStorage.getItem('dn_unlock') === '1'); } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [forceMode]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#fff',
      position: 'relative', overflow: 'hidden',
      fontFamily: DN_FONT, color: DN_COLORS.text,
      WebkitFontSmoothing: 'antialiased',
    }}>
      <DNScreenHeader
        leftLabel="피드"
        title={unlocked ? '기사 토론' : '기사'}
        subtitle={unlocked ? `${DEMO_MESSAGES.length}개의 댓글 · 비공개` : DEMO_ARTICLE.source}
        rightActions={
          <>
            {DNIcon.bookmark(unlocked)}
            {DNIcon.share()}
          </>
        }
      />
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
        overflow: 'hidden',
        background: unlocked ? '#fff' : '#fff',
      }}>
        {unlocked
          ? <ChatBody/>
          : <div style={{ height: '100%', overflowY: 'auto' }}>
              <ArticleBody article={DEMO_ARTICLE}/>
            </div>}
      </div>
    </div>
  );
}

window.ArticleDetailScreen = ArticleDetailScreen;
