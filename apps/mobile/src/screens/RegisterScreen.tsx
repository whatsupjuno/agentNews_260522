import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-002 회원가입 — REQ-001
type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen(_props: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-2xl font-bold text-textPrimary mb-6">회원가입</Text>
      <View className="bg-surface rounded-card p-4">
        <Text className="text-textSecondary">TODO: 이메일 / 비밀번호 / 닉네임 입력</Text>
      </View>
    </SafeAreaView>
  );
}
