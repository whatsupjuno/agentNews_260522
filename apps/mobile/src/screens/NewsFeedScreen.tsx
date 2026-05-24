import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';
import { useFeedSequence } from '../hooks/useFeedSequence';

// SCR-010 NewsFeedScreen — handoff §8.3 + jsx
type Props = NativeStackScreenProps<RootStackParamList, 'NewsFeed'>;

interface FeedArticle {
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
}

const CATEGORIES = ['헤드라인', '정치', '경제', '기술', '문화', '스포츠', '사회'];

export function NewsFeedScreen({ navigation }: Props) {
  const auth = useAuth();
  const seq = useFeedSequence();
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [activeCategory, setActiveCategory] = useState('헤드라인');
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  const load = useCallback(async () => {
    const access = await auth.getValidAccessToken();
    if (!access) return;
    try {
      const res = await apiFetch<{ articles: FeedArticle[] }>('/news/feed', { accessToken: access });
      setArticles(res.articles);
      setUpdatedAt(
        new Date().toLocaleTimeString('ko-KR', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      );
    } catch {
      // silent
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const handleCardTap = useCallback(
    async (article: FeedArticle) => {
      const advanced = await seq.onTapArticle(article.feedIndex);
      if (advanced) {
        // 시퀀스 완성 — chat 모드로 진입. 유일한 외부 신호.
        navigation.navigate('ArticleDetail', { articleId: article.id, mode: 'chat' });
        return;
      }
      // 위장 기본 동작 — armed 여부와 무관하게 일반 기사로 열림.
      // 단 armed + 정답 진행중인 경우는 advanced=false 라서 카드 열림 X (silent progress).
      if (seq.state.armed) return;
      navigation.navigate('ArticleDetail', { articleId: article.id, mode: 'normal' });
    },
    [seq, navigation],
  );

  const hero = articles.find((a) => a.kind === 'hero');
  const standard = articles.filter((a) => a.kind === 'standard');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007aff" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-2 pb-3 flex-row items-end justify-between">
          <View>
            <Text className="text-red" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
              5월 25일 · 일요일
            </Text>
            <Pressable onPress={seq.onTapWordmark} hitSlop={12}>
              <Text
                className="text-text"
                style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1.1, marginTop: 4 }}
              >
                DailyNews
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            className="w-10 h-10 rounded-pill bg-surface items-center justify-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}
          >
            <Text style={{ fontSize: 17, fontWeight: '600' }} className="text-text">
              {auth.user?.nickname?.charAt(0) ?? '?'}
            </Text>
          </Pressable>
        </View>

        {/* Category strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                className="rounded-pill"
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  backgroundColor: active ? '#1d1d1f' : '#ffffff',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: active ? '600' : '500',
                    color: active ? '#ffffff' : '#1d1d1f',
                  }}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Hero card */}
        {hero ? <HeroCard article={hero} onPress={() => handleCardTap(hero)} /> : null}

        {/* Section header */}
        <View className="flex-row items-end justify-between px-5 mt-6 mb-3">
          <Text className="text-text" style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
            많이 읽은 기사
          </Text>
          <Text className="text-accent" style={{ fontSize: 14, fontWeight: '500' }}>
            전체 보기
          </Text>
        </View>

        {/* Standard cards */}
        {standard.map((article) => (
          <StoryCard
            key={article.id}
            article={article}
            onPress={() => handleCardTap(article)}
          />
        ))}

        {/* Update timestamp */}
        {updatedAt ? (
          <Text className="text-muted text-center mt-6" style={{ fontSize: 12 }}>
            마지막 업데이트 · {updatedAt}
          </Text>
        ) : null}
      </ScrollView>

      {/* Bottom tab bar (blur 흉내) */}
      <View
        className="absolute bottom-0 left-0 right-0 flex-row justify-around bg-surface"
        style={{
          paddingTop: 12,
          paddingBottom: 22,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(60,60,67,0.12)',
        }}
      >
        <TabIcon label="홈" active />
        <TabIcon label="둘러보기" />
        <TabIcon label="검색" />
        <TabIcon label="설정" onPress={() => navigation.navigate('Settings')} />
      </View>
    </SafeAreaView>
  );
}

function HeroCard({ article, onPress }: { article: FeedArticle; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mx-5 bg-surface rounded-card overflow-hidden" style={{ marginBottom: 4 }}>
      <View style={{ height: 210, backgroundColor: article.tone.bg, justifyContent: 'flex-end', padding: 12 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: article.tone.fg, opacity: 0.6, letterSpacing: 1.4 }}>
          {article.tone.label}
        </Text>
      </View>
      <View className="p-4">
        <Text className="text-accent" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6 }}>
          {article.eyebrow.toUpperCase()} · 헤드라인
        </Text>
        <Text className="text-text mt-2" style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.4, lineHeight: 28 }}>
          {article.title}
        </Text>
        {article.summary ? (
          <Text className="text-muted mt-2" style={{ fontSize: 15, lineHeight: 21 }}>
            {article.summary}
          </Text>
        ) : null}
        <Text className="text-muted mt-3" style={{ fontSize: 12 }}>
          {article.source} · {article.publishedAgo}
        </Text>
      </View>
    </Pressable>
  );
}

function StoryCard({ article, onPress }: { article: FeedArticle; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-5 bg-surface rounded-card mt-3 flex-row p-3 items-start"
    >
      <View className="flex-1 pr-3">
        <Text className="text-accent" style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4 }}>
          {article.eyebrow.toUpperCase()}
        </Text>
        <Text
          className="text-text mt-1"
          style={{ fontSize: 16, fontWeight: '600', lineHeight: 22 }}
          numberOfLines={3}
        >
          {article.title}
        </Text>
        <Text className="text-muted mt-2" style={{ fontSize: 12 }}>
          {article.source} · {article.publishedAgo}
        </Text>
      </View>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 10,
          backgroundColor: article.tone.bg,
        }}
      />
    </Pressable>
  );
}

function TabIcon({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} className="items-center">
      <View
        className="w-7 h-7 rounded-md mb-1"
        style={{ backgroundColor: active ? '#007aff' : '#86868b', opacity: active ? 1 : 0.5 }}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: active ? '600' : '500',
          color: active ? '#007aff' : '#86868b',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
