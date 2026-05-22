import { FlatList, Pressable, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-010 뉴스 피드 — REQ-004, REQ-005, REQ-024
// 위장 진입점: 1·3·5·7번 카드 탭 순서가 시퀀스에 매칭되면 unlock_token 발급 → ArticleDetail 채팅 swap
type Props = NativeStackScreenProps<RootStackParamList, 'NewsFeed'>;

interface Article {
  id: string;
  feedIndex: number;
  title: string;
  source: string;
  publishedAgo: string;
  thumbnail?: string;
}

const MOCK_ARTICLES: Article[] = [
  { id: 'a1', feedIndex: 1, title: 'AI 모델 공개 — 안전성 논쟁 가열', source: '연합뉴스', publishedAgo: '3분 전' },
  { id: 'a2', feedIndex: 2, title: '00 정상회담 합의 도출', source: '한겨레', publishedAgo: '12분 전' },
  { id: 'a3', feedIndex: 3, title: '국내 IT 대기업 실적 발표', source: '매일경제', publishedAgo: '1시간 전' },
  { id: 'a4', feedIndex: 4, title: '기후변화 보고서 핵심', source: 'KBS', publishedAgo: '2시간 전' },
  { id: 'a5', feedIndex: 5, title: '문화재 발굴 현장 공개', source: 'MBC', publishedAgo: '3시간 전' },
  { id: 'a6', feedIndex: 6, title: '스타트업 투자 동향', source: '조선비즈', publishedAgo: '4시간 전' },
  { id: 'a7', feedIndex: 7, title: '신간 도서 리뷰', source: '경향신문', publishedAgo: '5시간 전' },
];

export function NewsFeedScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-5 pt-2 pb-3">
        <Text className="text-3xl font-bold text-textPrimary">오늘의 뉴스</Text>
      </View>
      <FlatList
        data={MOCK_ARTICLES}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('ArticleDetail', { articleId: item.id, feedIndex: item.feedIndex })
            }
            className="bg-surface rounded-card overflow-hidden"
          >
            {index === 0 ? (
              <View>
                <View className="h-44 bg-gray-200" />
                <View className="p-4">
                  <Text className="text-xs uppercase text-textSecondary tracking-wider">
                    {item.source} · {item.publishedAgo}
                  </Text>
                  <Text className="text-xl font-bold text-textPrimary mt-1">{item.title}</Text>
                </View>
              </View>
            ) : (
              <View className="flex-row p-3">
                <View className="flex-1 pr-3">
                  <Text className="text-xs uppercase text-textSecondary tracking-wider">
                    {item.source} · {item.publishedAgo}
                  </Text>
                  <Text className="text-base font-semibold text-textPrimary mt-1" numberOfLines={3}>
                    {item.title}
                  </Text>
                </View>
                <View className="w-24 h-24 bg-gray-200 rounded-lg" />
              </View>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
