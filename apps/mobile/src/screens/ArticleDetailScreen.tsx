import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

/**
 * SCR-011 기사 상세 + SCR-020 채팅 (위장 swap)
 * - 일반 모드: 기사 상세 표시
 * - 시퀀스 unlock + PAIRED 상태: 같은 헤더 유지하면서 본문을 채팅 리스트 + ChatInputBar 로 swap
 *
 * REQ-007, REQ-009, REQ-015, REQ-016, REQ-024
 */
type Props = NativeStackScreenProps<RootStackParamList, 'ArticleDetail'>;

type ViewMode = 'article' | 'chat';

interface Message {
  id: string;
  fromMe: boolean;
  body: string;
  sentAt: string;
}

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', fromMe: false, body: '잘 도착했어', sentAt: '12:01' },
  { id: 'm2', fromMe: true, body: 'ㅇㅇ 나도', sentAt: '12:02' },
  { id: 'm3', fromMe: false, body: '내일 그거 약속한 거 가져와줄 수 있어?', sentAt: '12:05' },
  { id: 'm4', fromMe: true, body: '응 챙겨놨음', sentAt: '12:05' },
];

export function ArticleDetailScreen({ route }: Props) {
  // 실제로는 unlock_token + PAIRED 상태를 store/hook 으로 판단
  const [mode] = useState<ViewMode>('article');

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-5 pt-2 pb-3 border-b border-gray-200">
        <Text className="text-xs uppercase text-textSecondary tracking-wider">연합뉴스 · 3분 전</Text>
        <Text className="text-xl font-bold text-textPrimary mt-1">
          AI 모델 공개 — 안전성 논쟁 가열
        </Text>
      </View>

      {mode === 'article' ? <ArticleView articleId={route.params.articleId} /> : <ChatView />}
    </SafeAreaView>
  );
}

function ArticleView({ articleId }: { articleId: string }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <View className="h-48 bg-gray-200 rounded-card mb-4" />
      <Text className="text-base leading-7 text-textPrimary">
        TODO: 기사 본문. articleId={articleId}. 외부 뉴스 API 캐시에서 가져옴.
      </Text>
      <Pressable className="mt-6 bg-surface rounded-card py-3 items-center">
        <Text className="text-accent font-medium">원문 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChatView() {
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 16 }}>
        {MOCK_MESSAGES.map((m) => (
          <View
            key={m.id}
            className={`mb-2 max-w-[78%] ${m.fromMe ? 'self-end' : 'self-start'}`}
          >
            <View
              className={`px-4 py-2.5 ${
                m.fromMe ? 'bg-bubbleMe rounded-bubble' : 'bg-bubblePeer rounded-bubble'
              }`}
            >
              <Text className={m.fromMe ? 'text-white text-base' : 'text-textPrimary text-base'}>
                {m.body}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row items-end px-3 py-2 border-t border-gray-200 bg-surface">
        <Pressable className="w-10 h-10 rounded-full bg-bg items-center justify-center mr-2">
          <Text className="text-accent text-xl">+</Text>
        </Pressable>
        <TextInput
          className="flex-1 bg-bg rounded-bubble px-4 py-2 text-textPrimary max-h-32"
          placeholder="메시지"
          placeholderTextColor="#86868b"
          multiline
        />
        <Pressable className="w-10 h-10 rounded-full bg-accent items-center justify-center ml-2">
          <Text className="text-white text-base">→</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
