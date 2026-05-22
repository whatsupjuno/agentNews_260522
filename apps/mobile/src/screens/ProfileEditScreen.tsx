import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-031 프로필 편집
type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen(_props: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 pt-6">
      <Text className="text-2xl font-bold text-textPrimary mb-4">프로필 편집</Text>
      <Text className="text-textSecondary">TODO: 닉네임 변경 + 계정 탈퇴</Text>
    </SafeAreaView>
  );
}
