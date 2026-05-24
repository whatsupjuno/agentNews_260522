import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../store/auth';
import { ApiError } from '../services/api';

// SCR-002 RegisterScreen — handoff §8.2
type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

interface Errors {
  email?: string;
  userId?: string;
  password?: string;
  passwordConfirm?: string;
  global?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_ID_RE = /^[a-zA-Z0-9_]{4,20}$/;

export function RegisterScreen({ navigation }: Props) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const e: Errors = {};
    if (!EMAIL_RE.test(email.trim())) e.email = '올바른 이메일 형식이 아닙니다.';
    if (!USER_ID_RE.test(userId)) e.userId = '사용자 ID는 4-20자 영문/숫자/_만 사용 가능합니다.';
    if (password.length < 8) e.password = '비밀번호는 8자 이상이어야 합니다.';
    if (password !== passwordConfirm) e.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit() {
    if (loading) return;
    if (!validate()) return;
    setLoading(true);
    try {
      await auth.register({
        email: email.trim(),
        password,
        nickname: nickname.trim() || userId,
        userId,
      });
      // AuthProvider 가 인증 상태 갱신 → RootNavigator 가 자동으로 NewsFeed 로 전환
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'AUTH_EMAIL_DUPLICATE') {
          setErrors({ email: '이미 가입된 이메일입니다.' });
        } else {
          setErrors({ global: e.message });
        }
      } else {
        setErrors({ global: '일시적인 오류가 발생했습니다.' });
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
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24 }}>
          <View className="flex-row items-center mb-6">
            <Pressable onPress={() => navigation.goBack()}>
              <Text className="text-accent" style={{ fontSize: 17 }}>‹ 로그인</Text>
            </Pressable>
          </View>

          <Text className="text-text mb-6" style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
            계정 만들기
          </Text>

          <FieldGroup label="이메일" error={errors.email}>
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="you@example.com"
              placeholderTextColor="#86868b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />
          </FieldGroup>

          <FieldGroup label="사용자 ID" error={errors.userId}>
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="4-20자, 영문/숫자/_"
              placeholderTextColor="#86868b"
              autoCapitalize="none"
              autoCorrect={false}
              value={userId}
              onChangeText={setUserId}
              editable={!loading}
            />
          </FieldGroup>

          <FieldGroup label="닉네임 (선택)">
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="표시될 이름"
              placeholderTextColor="#86868b"
              value={nickname}
              onChangeText={setNickname}
              editable={!loading}
            />
          </FieldGroup>

          <FieldGroup label="비밀번호" error={errors.password}>
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="8자 이상"
              placeholderTextColor="#86868b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </FieldGroup>

          <FieldGroup label="비밀번호 확인" error={errors.passwordConfirm}>
            <TextInput
              className="bg-bg rounded-md px-4 py-3 text-text"
              style={{ fontSize: 17 }}
              placeholder="다시 입력"
              placeholderTextColor="#86868b"
              secureTextEntry
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              editable={!loading}
            />
          </FieldGroup>

          {errors.global ? (
            <Text className="text-red mb-3" style={{ fontSize: 13 }}>
              {errors.global}
            </Text>
          ) : null}

          <Text className="text-muted mb-4" style={{ fontSize: 12, lineHeight: 18 }}>
            계정을 만들면 서비스 약관 및 개인정보 처리방침에 동의하는 것으로 간주합니다.
          </Text>

          <Pressable
            onPress={onSubmit}
            disabled={loading}
            className="rounded-card py-4 items-center"
            style={{ backgroundColor: loading ? '#a0c7ff' : '#007aff' }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-inverse font-semibold" style={{ fontSize: 17 }}>
                계정 만들기
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldGroup({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-muted mb-1.5" style={{ fontSize: 12, fontWeight: '500' }}>
        {label}
      </Text>
      {children}
      {error ? (
        <Text className="text-red mt-1" style={{ fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
