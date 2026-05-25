import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export interface YonhapArticle {
  position: number; // 1~7
  category: string; // 'HEADLINE' / 'POLITICS' / 'ECONOMY' / 'WORLD' / 'CULTURE' / 'SPORTS' / 'SOCIETY'
  categoryKr: string;
  title: string;
  description: string;
  url: string;
  image: string | null;
  source: string;
  publishedAt: string; // ISO
}

// 연합뉴스TV (yonhapnewstv.co.kr) 공식 RSS — 7 카테고리
const SLOTS: Array<{
  position: number;
  category: string;
  categoryKr: string;
  rssUrl: string;
}> = [
  {
    position: 1,
    category: 'HEADLINE',
    categoryKr: '헤드라인',
    rssUrl: 'http://www.yonhapnewstv.co.kr/browse/feed/',
  },
  {
    position: 2,
    category: 'POLITICS',
    categoryKr: '정치',
    rssUrl: 'http://www.yonhapnewstv.co.kr/category/news/politics/feed/',
  },
  {
    position: 3,
    category: 'ECONOMY',
    categoryKr: '경제',
    rssUrl: 'http://www.yonhapnewstv.co.kr/category/news/economy/feed/',
  },
  {
    position: 4,
    category: 'WORLD',
    categoryKr: '세계',
    rssUrl: 'http://www.yonhapnewstv.co.kr/category/news/international/feed/',
  },
  {
    position: 5,
    category: 'CULTURE',
    categoryKr: '문화·연예',
    rssUrl: 'http://www.yonhapnewstv.co.kr/category/news/culture/feed/',
  },
  {
    position: 6,
    category: 'SPORTS',
    categoryKr: '스포츠',
    rssUrl: 'http://www.yonhapnewstv.co.kr/category/news/sports/feed/',
  },
  {
    position: 7,
    category: 'SOCIETY',
    categoryKr: '사회',
    rssUrl: 'http://www.yonhapnewstv.co.kr/category/news/society/feed/',
  },
];

interface RssItem {
  title: unknown;
  link: unknown;
  description?: unknown;
  pubDate?: unknown;
  'dc:creator'?: unknown;
  'media:content'?:
    | { '@_url'?: string; '@_type'?: string }
    | Array<{ '@_url'?: string }>;
  enclosure?: { '@_url'?: string; '@_type'?: string };
}

interface RssRoot {
  rss?: {
    channel?: {
      item?: RssItem | RssItem[];
    };
  };
}

@Injectable()
export class YonhapRssClient {
  private readonly logger = new Logger(YonhapRssClient.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    cdataPropName: '#cdata',
    textNodeName: '#text',
  });

  /** 각 카테고리당 최대 N개 (default 5) fetch */
  async fetchAll(perCategory = 5): Promise<YonhapArticle[]> {
    const results: YonhapArticle[] = [];
    for (const slot of SLOTS) {
      try {
        const articles = await this.fetchMany(slot, perCategory);
        results.push(...articles);
      } catch (e) {
        this.logger.warn(`RSS fetch fail (${slot.categoryKr}): ${(e as Error).message}`);
      }
    }
    return results;
  }

  private async fetchMany(
    slot: (typeof SLOTS)[number],
    take: number,
  ): Promise<YonhapArticle[]> {
    const res = await fetch(slot.rssUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (agentNews bot)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = this.parser.parse(xml) as RssRoot;
    const items = parsed.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list.slice(0, take).map((raw) => this.toArticle(slot, raw));
  }

  private toArticle(slot: (typeof SLOTS)[number], item: RssItem): YonhapArticle {
    const title = this.unwrap(item.title) ?? '(제목 없음)';
    const description = this.unwrap(item.description) ?? '';
    const link = this.unwrap(item.link) ?? '';
    const pubDate = this.unwrap(item.pubDate);
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    return {
      position: slot.position,
      category: slot.category,
      categoryKr: slot.categoryKr,
      title: this.stripHtml(title).trim(),
      description: this.stripHtml(description).trim().slice(0, 280),
      url: link,
      image: this.extractImage(item, description),
      source: '연합뉴스TV',
      publishedAt,
    };
  }

  private extractImage(item: RssItem, description: string): string | null {
    const mc = item['media:content'];
    if (Array.isArray(mc) && mc[0]?.['@_url']) return mc[0]['@_url'];
    if (mc && !Array.isArray(mc) && mc['@_url']) return mc['@_url'];
    if (item.enclosure?.['@_url']) return item.enclosure['@_url'];
    // description 안의 첫 번째 <img src="..."> 추출
    const m = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m?.[1] ?? null;
  }

  private unwrap(v: unknown): string | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      if (typeof obj['#cdata'] === 'string') return obj['#cdata'];
      if (typeof obj['#text'] === 'string') return obj['#text'];
    }
    return String(v);
  }

  private stripHtml(s: string): string {
    return s
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }
}
