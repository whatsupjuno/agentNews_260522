import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-033 시퀀스 reset 요청 — REQ-008
type Props = NativeStackScreenProps<RootStackParamList, 'SequenceResetRequest'>;

export function SequenceResetRequestScreen(_props: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">시퀀스 재설정 링크</Text>
      <Text className="text-textSecondary">TODO: 이메일로 reset 링크 발송</Text>
    </SafeAreaView>
  );
}
