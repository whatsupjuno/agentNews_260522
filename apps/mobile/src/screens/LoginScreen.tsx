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

const DEMO = { userId: 'demo', password: 'demo1234' };

export function LoginScreen({ navigation }: Props) {
  const auth = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function doLogin(uid: string, pw: string) {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await auth.login({ userId: uid.trim(), password: pw });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function onDemo() {
    setUserId(DEMO.userId);
    setPassword(DEMO.password);
    await doLogin(DEMO.userId, DEMO.password);
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
              placeholder="사용자 ID"
              placeholderTextColor="#86868b"
              autoCapitalize="none"
              autoCorrect={false}
              value={userId}
              onChangeText={setUserId}
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
            onPress={() => doLogin(userId, password)}
            disabled={loading || !userId || !password}
            className="mt-6 rounded-card py-4 items-center"
            style={{ backgroundColor: loading || !userId || !password ? '#a0c7ff' : '#007aff' }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-inverse font-semibold" style={{ fontSize: 17 }}>
                로그인
              </Text>
            )}
          </Pressable>

          {/* Demo 계정 빠른 로그인 — Phase 1 데모 편의 */}
          <Pressable
            onPress={onDemo}
            disabled={loading}
            className="mt-3 rounded-card py-3 items-center"
            style={{
              borderWidth: 1,
              borderColor: '#007aff',
              backgroundColor: 'transparent',
            }}
          >
            <Text className="text-accent" style={{ fontSize: 15, fontWeight: '500' }}>
              데모 계정으로 로그인 (demo / demo1234)
            </Text>
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
