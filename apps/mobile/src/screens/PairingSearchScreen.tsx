import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-021 페어 검색 — REQ-010, REQ-011
type Props = NativeStackScreenProps<RootStackParamList, 'PairingSearch'>;

export function PairingSearchScreen(_props: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">페어 검색</Text>
      <Text className="text-textSecondary">TODO: external_id 입력 + 검색 결과 + 페어링 요청 버튼</Text>
    </SafeAreaView>
  );
}
