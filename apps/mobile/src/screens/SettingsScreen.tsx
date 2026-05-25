import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';
import { scheduleDisguisedDemoPush } from '../services/demoPush';

// SCR-030 SettingsScreen — handoff §8.7
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface MeResponse {
  externalId: string;
  userId: string;
  nickname: string;
  pairCount: number;
  peer: { externalId: string; nickname: string } | null;
}

export function SettingsScreen({ navigation }: Props) {
  const auth = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    void (async () => {
      const access = await auth.getValidAccessToken();
      if (!access) return;
      try {
        const res = await apiFetch<MeResponse>('/me', { accessToken: access });
        setMe(res);
      } catch {
        // silent
      }
    })();
  }, [auth]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="px-5 py-3 flex-row items-center">
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text className="text-accent" style={{ fontSize: 17 }}>‹ 피드</Text>
        </Pressable>
        <Text className="flex-1 text-center text-text" style={{ fontSize: 17, fontWeight: '600' }}>
          설정
        </Text>
        <View className="w-12" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {/* Profile card */}
        <Pressable
          onPress={() => navigation.navigate('ProfileEdit')}
          className="bg-surface rounded-cardLg p-4 flex-row items-center"
          style={{ marginTop: 8 }}
        >
          <View className="w-14 h-14 rounded-pill bg-bg items-center justify-center">
            <Text className="text-text" style={{ fontSize: 22, fontWeight: '700' }}>
              {me?.nickname?.charAt(0) ?? '?'}
            </Text>
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-text" style={{ fontSize: 18, fontWeight: '700' }}>
              {me?.nickname ?? '...'}
            </Text>
            <Text className="text-muted" style={{ fontSize: 13 }}>
              @{me?.userId ?? ''}
            </Text>
            {me?.pairCount ? (
              <View className="flex-row items-center mt-1">
                <View className="w-2 h-2 rounded-pill mr-1.5" style={{ backgroundColor: '#34c759' }} />
                <Text className="text-muted" style={{ fontSize: 12 }}>
                  구독자 {me.pairCount}명 연결됨
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-muted" style={{ fontSize: 18 }}>›</Text>
        </Pressable>

        {/* Account group */}
        <GroupHeader text="계정" />
        <Group>
          <Row icon="✎" iconBg="#8e8e93" label="프로필 편집" onPress={() => navigation.navigate('ProfileEdit')} />
          <Separator />
          <Row icon="🔒" iconBg="#5856d6" label="비밀번호 변경" />
          <Separator />
          <Row icon="@" iconBg="#34c759" label="사용자 ID" value={`@${me?.userId ?? ''}`} trailingChevron={false} />
        </Group>

        {/* App group */}
        <GroupHeader text="앱" />
        <Group>
          <Row
            icon="🔔"
            iconBg="#ff453a"
            label="알림 테스트"
            value="5초 후"
            onPress={async () => {
              const r = await scheduleDisguisedDemoPush();
              if (!r.delivered) {
                Alert.alert('알림 권한 필요', '설정 → 알림에서 권한 허용 후 다시 시도');
                return;
              }
              Alert.alert('5초 뒤 알림 도착', `홈 버튼으로 잠금화면 / 배경 이동\n\n📰 새 뉴스 — ${r.body}`);
            }}
          />
          <Separator />
          <Row icon="◐" iconBg="#5ac8fa" label="다크 모드" value="시스템" />
          <Separator />
          <Row icon="ⓘ" iconBg="#8e8e93" label="버전 정보" value="0.1.0 (1)" trailingChevron={false} />
        </Group>

        {/* Logout — v3: 버전 정보 group 과 분리 (간격 강화) */}
        <View style={{ height: 32 }} />
        <Group>
          <Pressable
            onPress={() => void auth.logout()}
            className="py-4 items-center"
          >
            <Text className="text-red" style={{ fontSize: 17 }}>
              로그아웃
            </Text>
          </Pressable>
        </Group>

        <Text className="text-muted text-center mt-6" style={{ fontSize: 12 }}>
          DailyNews · 0.1.0 (1)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupHeader({ text }: { text: string }) {
  return (
    <Text
      className="text-muted mt-6 mb-2 ml-3"
      style={{ fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 }}
    >
      {text}
    </Text>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <View className="bg-surface rounded-cardLg overflow-hidden">{children}</View>;
}

function Row({
  icon,
  iconBg,
  label,
  value,
  trailingChevron = true,
  onPress,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value?: string;
  trailingChevron?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3"
      style={{ minHeight: 44 }}
    >
      <View
        className="w-7 h-7 rounded-md items-center justify-center mr-3"
        style={{ backgroundColor: iconBg }}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{icon}</Text>
      </View>
      <Text className="flex-1 text-text" style={{ fontSize: 17 }}>
        {label}
      </Text>
      {value ? (
        <Text className="text-muted mr-2" style={{ fontSize: 15 }}>
          {value}
        </Text>
      ) : null}
      {trailingChevron ? <Text className="text-muted" style={{ fontSize: 18 }}>›</Text> : null}
    </Pressable>
  );
}

function Separator() {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: 'rgba(60,60,67,0.12)',
        marginLeft: 56,
      }}
    />
  );
}
