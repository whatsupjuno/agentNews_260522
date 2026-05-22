import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-032 시퀀스 변경 — REQ-006
type Props = NativeStackScreenProps<RootStackParamList, 'SequenceChange'>;

export function SequenceChangeScreen(_props: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">시퀀스 변경</Text>
      <Text className="text-textSecondary">TODO: 현재 시퀀스 재입력 → 새 시퀀스 등록</Text>
    </SafeAreaView>
  );
}
