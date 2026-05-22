import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-003 시퀀스 reset 딥링크 — REQ-008
type Props = NativeStackScreenProps<RootStackParamList, 'SequenceReset'>;

export function SequenceResetScreen({ route }: Props) {
  const token = route.params?.token;
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-2xl font-bold text-textPrimary mb-6">시퀀스 재설정</Text>
      <Text className="text-textSecondary">TODO: 새 시퀀스 등록 폼. token={token ?? '(없음)'}</Text>
    </SafeAreaView>
  );
}
