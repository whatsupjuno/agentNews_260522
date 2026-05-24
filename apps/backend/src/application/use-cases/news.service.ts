import { Injectable, NotFoundException } from '@nestjs/common';

/**
 * News service — Phase 1 은 정적 mock 풀.
 * GNews API key 발급되면 외부 fetch 로 교체. 캐시 TTL 10분.
 *
 * 기사 데이터는 design handoff `news-feed-screen.jsx` 의 mock 와 1:1 일치.
 * display_order(=feedIndex) 가 시퀀스 트래커의 position 으로 사용됨.
 */

export interface FeedArticle {
  id: string;
  feedIndex: number;
  kind: 'hero' | 'standard';
  eyebrow: string;
  category: string;
  title: string;
  summary?: string;
  source: string;
  publishedAgo: string;
  tone: { bg: string; fg: string; label: string };
  body?: string;
}

const MOCK_ARTICLES: FeedArticle[] = [
  {
    id: 'art-001',
    feedIndex: 1,
    kind: 'hero',
    eyebrow: '세계',
    category: 'WORLD',
    title: '기후 정상회담, 25개국 탄소 감축 합의안에 서명',
    summary:
      '서울에서 열린 제3차 글로벌 기후 정상회담에서 25개 참가국이 2030년까지 탄소 배출량 45% 감축에 합의했다.',
    source: '글로벌리포트',
    publishedAgo: '32분 전',
    tone: { bg: '#dbe5d3', fg: '#3a4530', label: 'WORLD' },
    body:
      '서울에서 열린 제3차 글로벌 기후 정상회담에서 25개 참가국이 2030년까지 탄소 배출량 45% 감축에 합의했다. ' +
      '이번 합의는 지난 두 차례의 정상회담에서 도출되지 못한 핵심 쟁점들에 대해 큰 진전을 이루었다는 평가다.\n\n' +
      '참가국 정상들은 사흘 간의 마라톤 협상 끝에 공동 합의안을 채택했으며, 각국은 ' +
      '향후 5년 내에 구체적인 이행 로드맵을 제출하기로 약속했다. ' +
      '환경 단체들은 이번 합의를 “역사적 진일보”로 평가하면서도 실제 이행 여부를 지켜봐야 한다고 신중한 입장을 보였다.',
  },
  {
    id: 'art-002',
    feedIndex: 2,
    kind: 'standard',
    eyebrow: '경제',
    category: 'ECONOMY',
    title: '한국은행, 기준금리 동결 결정… 시장 즉시 안도 랠리',
    source: '데일리이코노미',
    publishedAgo: '1시간 전',
    tone: { bg: '#dde4ec', fg: '#2b3a4a', label: 'ECONOMY' },
    body: '한국은행 금통위가 기준금리를 현 수준에서 동결하기로 결정했다고 발표했다. (생략)',
  },
  {
    id: 'art-003',
    feedIndex: 3,
    kind: 'standard',
    eyebrow: '기술',
    category: 'TECH',
    title: '신형 전기차 배터리, 충전 8분에 주행거리 512km 검증',
    source: '모빌리티투데이',
    publishedAgo: '1시간 전',
    tone: { bg: '#d3dde6', fg: '#27384a', label: 'TECH' },
    body: '국내 한 스타트업이 새로 개발한 전기차 배터리가 8분 충전에 512km 주행거리를 기록했다. (생략)',
  },
  {
    id: 'art-004',
    feedIndex: 4,
    kind: 'standard',
    eyebrow: '문화',
    category: 'CULTURE',
    title: 'K-드라마 신작, 28개국 OTT 시청률 동시 1위 달성',
    source: '컬처라인',
    publishedAgo: '2시간 전',
    tone: { bg: '#e7ddea', fg: '#42304a', label: 'CULTURE' },
    body: '최근 공개된 K-드라마 신작이 28개국 OTT 플랫폼에서 동시에 시청률 1위를 기록했다. (생략)',
  },
  {
    id: 'art-005',
    feedIndex: 5,
    kind: 'standard',
    eyebrow: '사회',
    category: 'URBAN',
    title: '도시 재생 프로젝트, 폐공장이 복합문화공간으로',
    source: '어반저널',
    publishedAgo: '3시간 전',
    tone: { bg: '#ece2d1', fg: '#4a3f28', label: 'URBAN' },
    body: '폐공장 부지가 복합 문화 공간으로 재탄생했다. (생략)',
  },
  {
    id: 'art-006',
    feedIndex: 6,
    kind: 'standard',
    eyebrow: '스포츠',
    category: 'SPORTS',
    title: '프로야구 개막전, 잠실 7만 1천명… 최다 관중 신기록',
    source: '스포츠데일리',
    publishedAgo: '4시간 전',
    tone: { bg: '#ecdcd6', fg: '#4a2f28', label: 'SPORTS' },
    body: '프로야구 개막전이 잠실 구장에서 7만 1천 명의 관중을 모았다. (생략)',
  },
  {
    id: 'art-007',
    feedIndex: 7,
    kind: 'standard',
    eyebrow: '기술',
    category: 'TECH',
    title: 'AI 윤리 가이드라인, 국가 단위 표준화 논의 본격화',
    source: '테크와이어',
    publishedAgo: '5시간 전',
    tone: { bg: '#d8e0db', fg: '#2c3a33', label: 'TECH' },
    body: 'AI 윤리 가이드라인 표준화 논의가 본격화되고 있다. (생략)',
  },
];

@Injectable()
export class NewsService {
  getFeed(): FeedArticle[] {
    return MOCK_ARTICLES;
  }

  getArticle(id: string): FeedArticle {
    const found = MOCK_ARTICLES.find((a) => a.id === id);
    if (!found) {
      throw new NotFoundException({ code: 'NEWS_ARTICLE_NOT_FOUND', message: '기사를 찾을 수 없습니다.' });
    }
    return found;
  }
}
