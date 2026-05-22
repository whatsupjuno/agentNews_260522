import { View, Text, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

// SCR-001 로그인 — REQ-002
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6 justify-center">
      <Text className="text-3xl font-bold text-textPrimary mb-2">DailyNews</Text>
      <Text className="text-base text-textSecondary mb-10">오늘의 뉴스</Text>

      <TextInput
        className="bg-surface rounded-card px-4 py-3 mb-3 text-textPrimary"
        placeholder="이메일"
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#86868b"
      />
      <TextInput
        className="bg-surface rounded-card px-4 py-3 mb-6 text-textPrimary"
        placeholder="비밀번호"
        secureTextEntry
        placeholderTextColor="#86868b"
      />
      <Pressable className="bg-accent rounded-card py-4 items-center">
        <Text className="text-white text-base font-semibold">로그인</Text>
      </Pressable>

      <View className="flex-row justify-center mt-6">
        <Text className="text-textSecondary">계정이 없으신가요? </Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text className="text-accent font-medium">가입</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
