import { useCallback, useEffect, useState } from 'react';
import {
  Image,
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

// SCR-010 NewsFeedScreen — handoff v3
//
// 시퀀스 입력 메커니즘 (v3):
//   1. DailyNews 워드마크 탭 → ARM (8초 타이머, 외관 변화 0)
//      단, 우측 프로필 아바타 배경색이 회색 (#e5e5ea) 으로 미세 변화 — 본인 인지용.
//   2. ARM 상태에서 카테고리 pill 의 position 5 → 3 → 1 → 7 순서로 탭 → unlock.
//   3. 카드 탭은 일반 기사 열기 (시퀀스 영향 0).
//
// Hero 카드 제거 — 균일 카드 그리드.
type Props = NativeStackScreenProps<RootStackParamList, 'NewsFeed'>;

interface FeedArticle {
  id: string;
  feedIndex: number;
  eyebrow: string;
  category: string;
  title: string;
  summary?: string;
  source: string;
  publishedAgo: string;
  tone: { bg: string; fg: string; label: string };
  imageUrl?: string;
  url?: string;
}

// 연합뉴스TV RSS 카테고리 1:1 매핑
const CATEGORIES = [
  { pos: 1, label: '헤드라인' },
  { pos: 2, label: '정치' },
  { pos: 3, label: '경제' },
  { pos: 4, label: '세계' },
  { pos: 5, label: '문화·연예' },
  { pos: 6, label: '스포츠' },
  { pos: 7, label: '사회' },
];

export function NewsFeedScreen({ navigation }: Props) {
  const auth = useAuth();
  const seq = useFeedSequence();
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [activeFilterIdx, setActiveFilterIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  const load = useCallback(async () => {
    const access = await auth.getValidAccessToken();
    if (!access) return;
    try {
      const res = await apiFetch<{ articles: FeedArticle[] }>('/news/feed', {
        accessToken: access,
      });
      setArticles(res.articles);
      setUpdatedAt(
        new Date().toLocaleTimeString('ko-KR', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      );
    } catch {
      // silent — 위장
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

  // 카테고리 탭 = 시퀀스 입력 (위장: 카테고리 필터처럼 보임)
  // dual sequence — chat [5,3,1,7] / admin [7,1,3,5]
  const handlePillTap = useCallback(
    async (pos: number, idx: number) => {
      setActiveFilterIdx(idx);
      const result = await seq.onTapArticle(pos);
      if (!result) return;
      if (result.kind === 'chat') {
        const firstArticleId = articles[0]?.id ?? 'art-1';
        navigation.navigate('ArticleDetail', { articleId: firstArticleId, mode: 'chat' });
      } else if (result.kind === 'admin') {
        if (auth.isAdmin) {
          navigation.navigate('Admin');
        }
        // admin 아니면 silent (위장)
      }
    },
    [seq, articles, navigation, auth.isAdmin],
  );

  // 카드 탭 = 일반 기사 열기 (시퀀스 영향 0)
  const handleCardTap = useCallback(
    (article: FeedArticle) => {
      navigation.navigate('ArticleDetail', { articleId: article.id, mode: 'normal' });
    },
    [navigation],
  );

  const armed = seq.state.armed;
  const avatarLetter = auth.user?.nickname?.charAt(0) ?? auth.user?.userId?.charAt(0) ?? '?';

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
          {/* Profile avatar — ARM 시 회색 배경 (미세 피드백) */}
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            className="w-10 h-10 rounded-pill items-center justify-center"
            style={{
              backgroundColor: armed ? '#e5e5ea' : '#ffffff',
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: armed ? '#86868b' : '#1d1d1f' }}>
              {avatarLetter}
            </Text>
          </Pressable>
        </View>

        {/* Category strip — position 1~7 = 시퀀스 입력 (위장: 일반 카테고리 필터) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {CATEGORIES.map((c, i) => {
            const active = i === activeFilterIdx;
            return (
              <Pressable
                key={c.pos}
                onPress={() => handlePillTap(c.pos, i)}
                className="rounded-pill"
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  backgroundColor: active ? '#1d1d1f' : 'rgba(0,0,0,0.05)',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: active ? '#ffffff' : '#1d1d1f',
                    letterSpacing: -0.1,
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section header */}
        <View className="flex-row items-end justify-between px-5 mb-3">
          <Text className="text-text" style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
            오늘의 기사
          </Text>
          <Text className="text-accent" style={{ fontSize: 14, fontWeight: '500' }}>
            전체 보기
          </Text>
        </View>

        {/* 균일 카드 그리드 — hero 제거 */}
        {articles.map((article) => (
          <StoryCard key={article.id} article={article} onPress={() => handleCardTap(article)} />
        ))}

        {/* Update timestamp */}
        {updatedAt ? (
          <Text className="text-muted text-center mt-6" style={{ fontSize: 12 }}>
            마지막 업데이트 · {updatedAt}
          </Text>
        ) : null}
      </ScrollView>

      {/* Bottom tab bar */}
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
      {article.imageUrl ? (
        <Image
          source={{ uri: article.imageUrl }}
          style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: article.tone.bg }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 10,
            backgroundColor: article.tone.bg,
          }}
        />
      )}
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
