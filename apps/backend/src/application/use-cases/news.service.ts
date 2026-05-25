import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { YonhapRssClient } from '../../infrastructure/news/yonhap-rss.client';

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
  imageUrl?: string;
  url?: string; // 외부 원문 link
}

const CATEGORY_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  HEADLINE: { bg: '#dbe5d3', fg: '#3a4530', label: 'HEADLINE' },
  POLITICS: { bg: '#e5d7d2', fg: '#4a3530', label: 'POLITICS' },
  ECONOMY: { bg: '#dde4ec', fg: '#2b3a4a', label: 'ECONOMY' },
  WORLD: { bg: '#d3dde6', fg: '#27384a', label: 'WORLD' },
  CULTURE: { bg: '#e7ddea', fg: '#42304a', label: 'CULTURE' },
  SPORTS: { bg: '#ecdcd6', fg: '#4a2f28', label: 'SPORTS' },
  SOCIETY: { bg: '#ece2d1', fg: '#4a3f28', label: 'SOCIETY' },
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30분

const MOCK_FALLBACK: FeedArticle[] = [
  { id: 'art-1', feedIndex: 1, kind: 'standard', eyebrow: '헤드라인', category: 'HEADLINE', title: '오늘의 주요 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.HEADLINE! },
  { id: 'art-2', feedIndex: 2, kind: 'standard', eyebrow: '정치', category: 'POLITICS', title: '정치 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.POLITICS! },
  { id: 'art-3', feedIndex: 3, kind: 'standard', eyebrow: '경제', category: 'ECONOMY', title: '경제 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.ECONOMY! },
  { id: 'art-4', feedIndex: 4, kind: 'standard', eyebrow: '세계', category: 'WORLD', title: '세계 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.WORLD! },
  { id: 'art-5', feedIndex: 5, kind: 'standard', eyebrow: '문화·연예', category: 'CULTURE', title: '문화 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.CULTURE! },
  { id: 'art-6', feedIndex: 6, kind: 'standard', eyebrow: '스포츠', category: 'SPORTS', title: '스포츠 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.SPORTS! },
  { id: 'art-7', feedIndex: 7, kind: 'standard', eyebrow: '사회', category: 'SOCIETY', title: '사회 뉴스', source: '연합뉴스TV', publishedAgo: '방금', tone: CATEGORY_TONE.SOCIETY! },
];

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);
  private cache: FeedArticle[] = MOCK_FALLBACK;
  private cacheAt = 0;

  constructor(private readonly rss: YonhapRssClient) {}

  async onModuleInit(): Promise<void> {
    void this.refresh();
  }

  async getFeed(): Promise<FeedArticle[]> {
    if (Date.now() - this.cacheAt > CACHE_TTL_MS) {
      void this.refresh();
    }
    return this.cache;
  }

  async getArticle(id: string): Promise<FeedArticle> {
    const found = this.cache.find((a) => a.id === id);
    if (!found) {
      throw new NotFoundException({
        code: 'NEWS_ARTICLE_NOT_FOUND',
        message: '기사를 찾을 수 없습니다.',
      });
    }
    return found;
  }

  private async refresh(): Promise<void> {
    try {
      const articles = await this.rss.fetchAll(5);
      if (articles.length === 0) {
        this.logger.warn('Yonhap fetch returned 0 articles — keeping cache');
        return;
      }
      const now = Date.now();
      const mapped: FeedArticle[] = articles.map((a, idx) => ({
        id: `art-${a.position}-${idx}`,
        feedIndex: a.position,
        kind: 'standard',
        eyebrow: a.categoryKr,
        category: a.category,
        title: a.title,
        summary: a.description ? a.description.slice(0, 140) : undefined,
        source: a.source,
        publishedAgo: this.relativeTime(a.publishedAt),
        tone: CATEGORY_TONE[a.category] ?? CATEGORY_TONE.HEADLINE!,
        body: a.description,
        imageUrl: a.image ?? undefined,
        url: a.url,
      }));
      // 카테고리 누락 시 fallback 채움
      const finalArticles: FeedArticle[] = [...mapped];
      for (let pos = 1; pos <= 7; pos++) {
        if (!mapped.some((m) => m.feedIndex === pos)) {
          const fb = MOCK_FALLBACK.find((m) => m.feedIndex === pos);
          if (fb) finalArticles.push(fb);
        }
      }
      this.cache = finalArticles;
      this.cacheAt = now;
      this.logger.log(`news cache refreshed (${mapped.length} articles across 7 categories)`);
    } catch (e) {
      this.logger.error(`news refresh failed: ${(e as Error).message}`);
    }
  }

  private relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return '방금';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}일 전`;
  }
}
