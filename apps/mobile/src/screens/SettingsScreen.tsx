import { Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-030 설정 — REQ-003
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const ROWS = [
  { label: '프로필 편집', target: 'ProfileEdit' as const },
  { label: '시퀀스 변경', target: 'SequenceChange' as const },
  { label: '시퀀스 재설정 요청', target: 'SequenceResetRequest' as const },
  { label: '페어 해제', target: 'PairDisconnect' as const },
];

export function SettingsScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">설정</Text>
      <View className="bg-surface rounded-card overflow-hidden">
        {ROWS.map((r, i) => (
          <Pressable
            key={r.target}
            onPress={() => navigation.navigate(r.target as never)}
            className={`px-4 py-4 ${i < ROWS.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <Text className="text-textPrimary text-base">{r.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable className="mt-6 bg-surface rounded-card px-4 py-4">
        <Text className="text-danger text-base text-center">로그아웃</Text>
      </Pressable>
    </SafeAreaView>
  );
}
