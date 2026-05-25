import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';

// SCR-031 ProfileEditScreen + DataDelete Modal — handoff §8.8
type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen({ navigation }: Props) {
  const auth = useAuth();
  const [nickname, setNickname] = useState(auth.user?.nickname ?? '');
  const [statusMessage, setStatusMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const access = await auth.getValidAccessToken();
      if (!access) return;
      await apiFetch('/me', {
        method: 'PATCH',
        body: { nickname, statusMessage },
        accessToken: access,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="px-5 py-3 flex-row items-center">
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text className="text-accent" style={{ fontSize: 17 }}>‹ 설정</Text>
        </Pressable>
        <Text className="flex-1 text-center text-text" style={{ fontSize: 17, fontWeight: '600' }}>
          프로필 편집
        </Text>
        <Pressable onPress={save} hitSlop={12} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#007aff" />
          ) : (
            <Text className="text-accent" style={{ fontSize: 17, fontWeight: '600' }}>저장</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          {/* Avatar */}
          <View className="items-center mt-6 mb-6">
            <View className="w-24 h-24 rounded-pill bg-surface items-center justify-center">
              <Text className="text-text" style={{ fontSize: 36, fontWeight: '700' }}>
                {nickname.charAt(0) || '?'}
              </Text>
            </View>
            <View
              className="absolute"
              style={{
                bottom: 0,
                right: 130,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#007aff',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#f5f5f7',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>⊕</Text>
            </View>
          </View>

          <View className="bg-surface rounded-cardLg overflow-hidden">
            <FieldRow label="닉네임">
              <TextInput
                className="text-text"
                style={{ fontSize: 17 }}
                value={nickname}
                onChangeText={setNickname}
                editable={!saving}
              />
            </FieldRow>
            <FieldSeparator />
            <FieldRow label="사용자 ID (고정)">
              <Text className="text-muted" style={{ fontSize: 17 }}>@{auth.user?.userId}</Text>
            </FieldRow>
            <FieldSeparator />
            <FieldRow label="상태 메시지">
              <TextInput
                className="text-text"
                style={{ fontSize: 17 }}
                placeholder="없음"
                placeholderTextColor="#86868b"
                value={statusMessage}
                onChangeText={setStatusMessage}
                editable={!saving}
              />
            </FieldRow>
          </View>

          {/* Destructive */}
          <Pressable
            onPress={() => setShowDelete(true)}
            className="bg-surface rounded-cardLg py-4 mt-8 items-center"
          >
            <Text className="text-red" style={{ fontSize: 17, fontWeight: '500' }}>
              데이터 삭제
            </Text>
          </Pressable>
          <Text className="text-muted text-center mt-3" style={{ fontSize: 12, lineHeight: 18 }}>
            계정 + 모든 댓글 + 첨부 + 구독자 연결이 영구 삭제됩니다.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <DataDeleteModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirmed={async () => {
          const access = await auth.getValidAccessToken();
          if (!access) return;
          await apiFetch('/me', { method: 'DELETE', accessToken: access });
          await auth.logout();
        }}
      />
    </SafeAreaView>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="px-4 py-3">
      <Text className="text-muted mb-1" style={{ fontSize: 12, fontWeight: '500' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function FieldSeparator() {
  return (
    <View style={{ height: 0.5, backgroundColor: 'rgba(60,60,67,0.12)', marginLeft: 16 }} />
  );
}

function DataDeleteModal({
  visible,
  onClose,
  onConfirmed,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canConfirm = input.trim() === '삭제' && !deleting;

  async function confirm() {
    if (!canConfirm) return;
    setDeleting(true);
    try {
      await onConfirmed();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView className="flex-1 bg-surface">
        <View className="bg-red px-6 py-5">
          <Text className="text-inverse" style={{ fontSize: 17, fontWeight: '600' }}>
            데이터 삭제
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <View
            className="self-center mb-6 items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffe5e3' }}
          >
            <Text style={{ fontSize: 36, color: '#ff3b30', fontWeight: '700' }}>!</Text>
          </View>
          <Text
            className="text-text text-center"
            style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}
          >
            모든 데이터를{'\n'}삭제하시겠어요?
          </Text>
          <View className="mt-6 gap-2">
            {[
              '계정 영구 삭제',
              '모든 댓글 + 첨부 삭제',
              '구독자 연결 자동 해제',
              '복구 불가능',
            ].map((line) => (
              <View key={line} className="flex-row items-start">
                <Text className="text-muted mr-2" style={{ fontSize: 15 }}>•</Text>
                <Text className="text-text flex-1" style={{ fontSize: 15, lineHeight: 22 }}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-muted mt-8 mb-2" style={{ fontSize: 13 }}>
            "삭제" 라고 입력해 주세요
          </Text>
          <TextInput
            className="bg-bg rounded-md px-4 py-3 text-text"
            style={{ fontSize: 17 }}
            placeholder="삭제"
            placeholderTextColor="#c5c5c7"
            value={input}
            onChangeText={setInput}
            editable={!deleting}
          />

          <Pressable
            onPress={confirm}
            disabled={!canConfirm}
            className="rounded-card py-4 mt-6 items-center"
            style={{ backgroundColor: canConfirm ? '#ff3b30' : '#ffb5b1' }}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-inverse" style={{ fontSize: 17, fontWeight: '600' }}>
                데이터 삭제
              </Text>
            )}
          </Pressable>

          <Pressable onPress={onClose} className="mt-4 items-center" disabled={deleting}>
            <Text className="text-accent" style={{ fontSize: 17 }}>
              취소
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
