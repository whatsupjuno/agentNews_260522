import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-022 페어링 확인 — REQ-012
type Props = NativeStackScreenProps<RootStackParamList, 'PairingRequest'>;

export function PairingRequestScreen({ route }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">페어링 요청</Text>
      <Text className="text-textSecondary">TODO: 수락 / 거부 / 취소. pairingId={route.params.pairingId}</Text>
    </SafeAreaView>
  );
}
