import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-034 페어 해제 확인 — REQ-013
type Props = NativeStackScreenProps<RootStackParamList, 'PairDisconnect'>;

export function PairDisconnectScreen(_props: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">페어 해제</Text>
      <Text className="text-textSecondary">
        TODO: 해제 시 양측 메시지 + 첨부 즉시 삭제. 되돌릴 수 없음.
      </Text>
    </SafeAreaView>
  );
}
