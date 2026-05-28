import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path as SvgPath, Circle as SvgCircle } from 'react-native-svg';
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
  imageUrl?: string;
  url?: string;
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
      {!isChat && (
        <Header
          title="기사"
          subtitle={article?.source ?? ''}
          onBack={() => navigation.goBack()}
          isChat={false}
        />
      )}
      {isChat ? (
        <ChatBody article={article} onBack={() => navigation.goBack()} />
      ) : (
        <ArticleBody article={article} />
      )}

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
      {article.imageUrl ? (
        <Image
          source={{ uri: article.imageUrl }}
          style={{ height: 260, width: '100%', backgroundColor: article.tone?.bg ?? '#e5e5ea' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            height: 260,
            backgroundColor: article.tone?.bg ?? '#e5e5ea',
          }}
        />
      )}
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
        {article.url ? (
          <Pressable
            onPress={() => Linking.openURL(article.url!)}
            className="bg-bg rounded-card py-3 mt-6 items-center"
            style={{ borderWidth: 1, borderColor: 'rgba(60,60,67,0.12)' }}
          >
            <Text className="text-text" style={{ fontSize: 15, fontWeight: '500' }}>
              원문 보기
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * Keyboard inset = windowHeight - endCoordinates.screenY.
 * height 가 아닌 screenY 를 쓰는 이유: SafeArea bottom inset 등을 고려한 정확한 keyboard top 위치.
 */
function useKeyboardInset(): number {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardTopY, setKeyboardTopY] = useState<number | null>(null);

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, (e) => {
      setKeyboardTopY(e?.endCoordinates?.screenY ?? null);
    });
    const hide = Keyboard.addListener(hideEv, () => setKeyboardTopY(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return useMemo(() => {
    if (keyboardTopY == null) return 0;
    return Math.max(0, windowHeight - keyboardTopY);
  }, [windowHeight, keyboardTopY]);
}

function ChatBody({
  article: _article,
  onBack,
}: {
  article: Article | null;
  onBack: () => void;
}) {
  const chat = useChat();
  const [input, setInput] = useState('');
  const keyboardInset = useKeyboardInset();
  const keyboardVisible = keyboardInset > 0;
  const [inputBarH, setInputBarH] = useState(80);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  function onSubmit() {
    if (!input.trim()) return;
    const body = input;
    setInput('');
    void chat.send(body);
  }

  // 첫 메시지 위 day separator 텍스트
  const daySep = useMemo(() => {
    const now = new Date();
    const ampm = now.getHours() < 12 ? '오전' : '오후';
    const hr = ((now.getHours() + 11) % 12) + 1;
    return `오늘 ${ampm} ${hr}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  function onListScroll(e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollDown(distFromBottom > 200);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 64,
          paddingBottom: keyboardInset + inputBarH + 3,
        }}
        data={chat.messages}
        keyExtractor={(m) => m.externalId}
        renderItem={({ item, index }) => {
          const prev = chat.messages[index - 1];
          const grouped = prev && prev.fromMe === item.fromMe && msToSec(item, prev) < 60;
          return <Bubble msg={item} groupedAbove={!!grouped} />;
        }}
        ListHeaderComponent={
          chat.messages.length > 0 ? (
            <Text
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: '#86868b',
                marginBottom: 14,
                letterSpacing: 0.2,
                fontWeight: '500',
              }}
            >
              {daySep}
            </Text>
          ) : null
        }
        onScroll={onListScroll}
        scrollEventThrottle={64}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
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

      {/* Floating top chrome — back pill (chat 모드 헤더 대신) */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          right: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 25,
        }}
      >
        <Pressable
          onPress={onBack}
          style={{
            backgroundColor: 'rgba(255,255,255,0.86)',
            borderWidth: 0.5,
            borderColor: 'rgba(60,60,67,0.10)',
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1d1d1f', lineHeight: 18 }}>‹</Text>
        </Pressable>
      </View>

      {/* Scroll-to-bottom 플로팅 버튼 */}
      {showScrollDown ? (
        <Pressable
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: keyboardInset + inputBarH + 12,
            width: 36,
            height: 36,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderWidth: 0.5,
            borderColor: 'rgba(60,60,67,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            zIndex: 28,
          }}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <SvgPath d="M2 5l5 5 5-5" stroke="#1d1d1f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      ) : null}

      {/* Composer — 카드 형식, absolute. 키보드 위 1px (활성 시). */}
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setInputBarH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: keyboardInset + (keyboardVisible ? 1 : 0),
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: keyboardVisible ? 8 : Platform.OS === 'ios' ? 30 : 14,
          backgroundColor: '#ffffff',
        }}
      >
        <View
          style={{
            backgroundColor: '#f4f4f6',
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 10,
            shadowColor: '#000',
            shadowOpacity: 0.04,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
          }}
        >
          <TextInput
            style={{
              fontSize: 17,
              color: '#1d1d1f',
              letterSpacing: -0.2,
              paddingTop: 0,
              paddingBottom: 8,
              maxHeight: 120,
            }}
            placeholder="댓글 입력"
            placeholderTextColor="#86868b"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
            <Pressable
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
            >
              <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
                <SvgCircle cx={11} cy={11} r={10} stroke="#86868b" strokeWidth={1.8} />
                <SvgPath d="M11 7v8M7 11h8" stroke="#86868b" strokeWidth={1.8} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={!input.trim()}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: input.trim() ? '#1d1d1f' : '#d6d6db',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <SvgPath d="M7 12V2M3 6l4-4 4 4" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function msToSec(a: ChatMessage, b: ChatMessage): number {
  return Math.abs(new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()) / 1000;
}

function Bubble({ msg, groupedAbove }: { msg: ChatMessage; groupedAbove: boolean }) {
  const me = msg.fromMe;
  const unreadByPeer = me && !msg.readAt;

  // 새 디자인: neutral palette — me=dark surface, peer=light surface (iMessage blue 제거)
  const tail = 20;
  const pinch = 6;
  const bg = me ? '#1d1d1f' : '#f0f0f3';
  const fg = me ? '#ffffff' : '#1d1d1f';

  return (
    <View
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        marginTop: groupedAbove ? 2 : 10,
        flexDirection: 'row',
        alignItems: 'flex-end',
      }}
    >
      {unreadByPeer ? (
        <Text
          style={{
            fontSize: 11,
            color: '#ff9500',
            fontWeight: '600',
            marginRight: 4,
            marginBottom: 0,
          }}
        >
          1
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: bg,
          borderTopLeftRadius: me ? tail : groupedAbove ? pinch : tail,
          borderTopRightRadius: me && groupedAbove ? pinch : tail,
          borderBottomLeftRadius: tail,
          borderBottomRightRadius: me ? tail : tail,
          paddingHorizontal: 14,
          paddingTop: 9,
          paddingBottom: 10,
          flexShrink: 1,
        }}
      >
        <Text
          style={{
            color: fg,
            fontSize: 16,
            lineHeight: 22,
            letterSpacing: -0.2,
          }}
        >
          {msg.body}
        </Text>
      </View>
    </View>
  );
}
