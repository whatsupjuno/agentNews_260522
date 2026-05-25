import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';
import { useUnlock } from '../store/unlock';
import { useChat, type ChatMessage } from '../hooks/useChat';
import { useBackgroundDisguise } from '../hooks/useBackgroundDisguise';

/**
 * SCR-011 + SCR-020 — handoff §8.4
 * 같은 RN screen 안에서 conditional swap.
 * Header chrome 은 두 모드 공통 (외부 관찰자가 “기사 보고 있구나” 인식).
 */
type Props = NativeStackScreenProps<RootStackParamList, 'ArticleDetail'>;

interface Article {
  id: string;
  title: string;
  source: string;
  publishedAgo: string;
  body?: string;
  tone: { bg: string; fg: string };
  eyebrow: string;
}

export function ArticleDetailScreen({ route, navigation }: Props) {
  const { articleId, mode: forceMode } = route.params;
  const unlock = useUnlock();
  const auth = useAuth();
  const [article, setArticle] = useState<Article | null>(null);

  // unlock 살아있을 때만 chat 모드. forceMode='normal' 이면 강제 article view.
  // 즉 데모/외부 nav 의 mode 파라미터 무관하게 실제 잠금 상태만이 진입 조건 (handoff §8.4).
  const isUnlocked = unlock.isUnlocked();
  const isChat = forceMode === 'normal' ? false : isUnlocked;

  // 백그라운드 위장 (채팅 모드 활성 시만)
  const { shouldDisguise } = useBackgroundDisguise(isChat);

  // unlock 만료/해제 → NewsFeed 자동 복귀 (REQ-023 / handoff §8.4).
  // forceMode='chat' 으로 진입했는데 unlock 사라지면 채팅 화면 보존하지 않고 즉시 복귀.
  useEffect(() => {
    if (forceMode === 'chat' && !isUnlocked) {
      navigation.popToTop();
    }
  }, [forceMode, isUnlocked, navigation]);

  useLayoutEffect(() => {
    // 위장 검수: route param 의 mode 가 외부에서 deeplink 로 들어올 수 없도록
    // navigation 자체가 internal 만 (RN URL bar 없음).
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await auth.getValidAccessToken();
      if (!access) return;
      try {
        const res = await apiFetch<Article>(`/articles/${articleId}`, { accessToken: access });
        setArticle(res);
      } catch {
        // silent
      }
    })();
  }, [articleId, auth]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Header
        title={isChat ? '기사 토론' : '기사'}
        subtitle={article?.source ?? ''}
        onBack={() => navigation.goBack()}
        isChat={isChat}
      />
      {isChat ? <ChatBody article={article} /> : <ArticleBody article={article} />}

      {shouldDisguise ? (
        <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View className="flex-1 bg-bg" />
        </BlurView>
      ) : null}
    </SafeAreaView>
  );
}

function Header({
  title,
  subtitle,
  onBack,
  isChat,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  isChat: boolean;
}) {
  return (
    <View
      className="flex-row items-center px-4 py-3 bg-surface"
      style={{ borderBottomWidth: 0.5, borderBottomColor: 'rgba(60,60,67,0.12)' }}
    >
      <Pressable onPress={onBack} hitSlop={12}>
        <Text className="text-accent" style={{ fontSize: 17 }}>‹ 피드</Text>
      </Pressable>
      <View className="flex-1 items-center">
        <Text className="text-text" style={{ fontSize: 15, fontWeight: '600' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted" style={{ fontSize: 11 }}>
            {isChat ? subtitle : subtitle}
          </Text>
        ) : null}
      </View>
      <View className="w-12" />
    </View>
  );
}

function ArticleBody({ article }: { article: Article | null }) {
  if (!article) {
    return <View className="flex-1 items-center justify-center" />;
  }
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      <View
        style={{
          height: 260,
          backgroundColor: article.tone?.bg ?? '#e5e5ea',
        }}
      />
      <View className="px-6 pt-6">
        <Text className="text-accent" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6 }}>
          {article.eyebrow.toUpperCase()}
        </Text>
        <Text
          className="text-text mt-2"
          style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 33 }}
        >
          {article.title}
        </Text>
        <Text className="text-muted mt-3" style={{ fontSize: 13 }}>
          {article.source} · {article.publishedAgo}
        </Text>
        <Text
          className="text-text mt-6"
          style={{ fontSize: 16, lineHeight: 26, letterSpacing: -0.2 }}
        >
          {article.body ?? '본문이 준비되지 않았습니다.'}
        </Text>
        <Pressable
          className="bg-bg rounded-card py-3 mt-6 items-center"
          style={{ borderWidth: 1, borderColor: 'rgba(60,60,67,0.12)' }}
        >
          <Text className="text-text" style={{ fontSize: 15, fontWeight: '500' }}>
            원문 보기
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ChatBody({ article: _article }: { article: Article | null }) {
  const chat = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (chat.messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [chat.messages.length]);

  function onSubmit() {
    if (!input.trim()) return;
    const body = input;
    setInput('');
    void chat.send(body);
  }

  // v3: pinned context card 제거. 헤더 바로 아래에서 메시지 리스트 시작.
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <FlatList
        ref={listRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}
        data={chat.messages}
        keyExtractor={(m) => m.externalId}
        renderItem={({ item, index }) => {
          const prev = chat.messages[index - 1];
          const grouped = prev && prev.fromMe === item.fromMe && msToSec(item, prev) < 60;
          return <Bubble msg={item} groupedAbove={!!grouped} />;
        }}
        ListEmptyComponent={
          !chat.loading ? (
            <View className="items-center mt-8">
              <Text className="text-muted" style={{ fontSize: 14 }}>
                댓글이 없습니다
              </Text>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <View
        className="flex-row items-end px-3 py-2 bg-surface"
        style={{
          paddingBottom: Platform.OS === 'ios' ? 30 : 14,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(60,60,67,0.12)',
        }}
      >
        <Pressable className="w-9 h-9 rounded-pill bg-chip items-center justify-center mr-2">
          <Text className="text-text" style={{ fontSize: 18 }}>+</Text>
        </Pressable>
        <View className="flex-1 bg-surface mr-2" style={{ borderWidth: 0.5, borderColor: 'rgba(60,60,67,0.12)', borderRadius: 22 }}>
          <TextInput
            className="text-text"
            style={{ paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, maxHeight: 120 }}
            placeholder="댓글 입력"
            placeholderTextColor="#86868b"
            value={input}
            onChangeText={setInput}
            multiline
          />
        </View>
        <Pressable
          onPress={onSubmit}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-pill items-center justify-center"
          style={{ backgroundColor: input.trim() ? '#007aff' : '#c5c5c7' }}
        >
          <Text className="text-inverse" style={{ fontSize: 18, fontWeight: '700', lineHeight: 18 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function msToSec(a: ChatMessage, b: ChatMessage): number {
  return Math.abs(new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()) / 1000;
}

function Bubble({ msg, groupedAbove }: { msg: ChatMessage; groupedAbove: boolean }) {
  const me = msg.fromMe;
  return (
    <View
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        marginTop: groupedAbove ? 3 : 10,
      }}
    >
      <View
        style={{
          backgroundColor: me ? '#007aff' : '#e9e9eb',
          borderRadius: 22,
          borderBottomRightRadius: me && !groupedAbove ? 4 : 22,
          borderTopRightRadius: me && groupedAbove ? 4 : 22,
          borderBottomLeftRadius: !me && !groupedAbove ? 4 : 22,
          borderTopLeftRadius: !me && groupedAbove ? 4 : 22,
          paddingHorizontal: 14,
          paddingVertical: 9,
        }}
      >
        <Text style={{ color: me ? '#fff' : '#1d1d1f', fontSize: 17, lineHeight: 22 }}>
          {msg.body}
        </Text>
      </View>
    </View>
  );
}
