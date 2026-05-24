import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../store/auth';
import { ApiError } from '../services/api';

// SCR-001 LoginScreen — design handoff §8.1
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await auth.login({ email: email.trim(), password });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-6 justify-center">
          <View className="items-center mb-12">
            <Text
              style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}
              className="text-text"
            >
              DailyNews
            </Text>
            <Text className="text-muted mt-2" style={{ fontSize: 13 }}>
              매일의 뉴스를 한 곳에서
            </Text>
          </View>

          <View className="gap-3 mb-2">
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="이메일"
              placeholderTextColor="#86868b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="비밀번호"
              placeholderTextColor="#86868b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>

          {error ? (
            <Text className="text-red mt-1" style={{ fontSize: 12, fontWeight: '500' }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={loading || !email || !password}
            className="mt-6 rounded-card py-4 items-center"
            style={{ backgroundColor: loading || !email || !password ? '#a0c7ff' : '#007aff' }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-inverse font-semibold" style={{ fontSize: 17 }}>
                로그인
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center mt-6 gap-6">
            <Text className="text-muted" style={{ fontSize: 14 }}>
              비밀번호 찾기
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Register')}
              className="border border-red rounded-pill px-3 py-1"
            >
              <Text className="text-red" style={{ fontSize: 13, fontWeight: '600' }}>
                회원가입
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
