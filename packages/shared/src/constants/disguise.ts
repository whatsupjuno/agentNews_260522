/**
 * 위장 어휘 매핑 — Design Handoff v2 §5.
 * 내부 코드 명칭 그대로 유지 (DB column, enum, class name) + 외부 노출 string 만 위장.
 *
 * 사용 패턴:
 *   import { DISGUISE_LABELS } from '@agentnews/shared';
 *   <Text>{DISGUISE_LABELS.chatHeader}</Text>   // "기사 토론" (NOT "채팅")
 */

export const DISGUISE_LABELS = {
  // 화면 헤더
  chatHeader: '기사 토론',
  chatSubtitleFmt: (count: number) => `${count}개의 댓글 · 비공개`,
  articleHeader: '기사',

  // 메시지 / 댓글
  message: '댓글',
  messages: '댓글',
  messageInputPlaceholder: '댓글 입력',
  noMessages: '댓글이 없습니다',

  // 페어링 / 구독자
  pair: '구독자',
  pairConnectedFmt: (count: number) => `구독자 ${count}명 연결됨`,
  pairDisconnect: '구독 해제',

  // 시퀀스 / 잠금 코드
  sequence: '콘텐츠 잠금 코드',
  unlockExpired: '잠금이 만료되었습니다',

  // 위장 푸시
  pushTitle: '📰 새 뉴스',

  // 위장 응답 코드 (외부 노출 — 비밀 도메인 endpoint 모든 권한 거부)
  externalErrorCode: 'NEWS_ARTICLE_NOT_FOUND',
  externalErrorMessage: '기사를 찾을 수 없습니다.',
} as const;

/**
 * 금지 단어 — 외부 노출 (UI string / push title / log message / API response message) 에
 * 절대 포함되지 말아야 함. M6 검수에서 grep.
 */
export const DISGUISE_FORBIDDEN_WORDS = [
  // 한국어
  '채팅',
  '비밀',
  '메시지',
  '에이전트',
  '시퀀스',
  '페어',
  '잠금해제',
  // 영어 (소문자 비교)
  'chat',
  'secret',
  'agent',
  'message',
  'pair',
  'pairing',
  'sequence',
  'unlock',
  'discussion',
] as const;

/**
 * 위장 푸시 알림 본문 풀 — fake headlines fallback.
 * 운영은 DB `fake_headlines` 테이블에서 select. 클라이언트 / 백엔드 일관성용 fallback 상수.
 */
export const FAKE_HEADLINE_FALLBACK_POOL = [
  'AI 모델 공개 — 안전성 논쟁 가열',
  '기후 정상회담, 25개국 탄소 감축 합의안에 서명',
  '한국은행, 기준금리 동결 결정… 시장 즉시 안도 랠리',
  '신형 전기차 배터리, 충전 8분에 주행거리 512km 검증',
  'K-드라마 신작, 28개국 OTT 시청률 동시 1위 달성',
  '도시 재생 프로젝트, 폐공장이 복합문화공간으로',
  '프로야구 개막전, 잠실 7만 1천명… 최다 관중 신기록',
  'AI 윤리 가이드라인, 국가 단위 표준화 논의 본격화',
  '국제 우주 정거장, 새 모듈 도킹 성공',
  '서울 청년 창업 지원금, 신청 접수 시작',
] as const;
