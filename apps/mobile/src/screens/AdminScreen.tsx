import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { apiFetch, ApiError } from '../services/api';
import { useAuth } from '../store/auth';

// Admin Screen — design-admin-pending v0.2 기반
// 4 tab: home / users / arm / chats
// 진입: NewsFeed 워드마크 ARM + 카테고리 [7,1,3,5] 탭 (admin 시퀀스)
type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

type Tab = 'home' | 'users' | 'arm' | 'chats';

interface AdminUserRow {
  id: string;
  userId: string;
  nickname: string;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  pairedWith: string | null;
  messageCount: number;
  createdAt: string;
}

interface AdminChatRow {
  pairingId: string;
  pairingExternalId: string;
  a: { userId: string; nickname: string };
  b: { userId: string; nickname: string };
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

const CATEGORIES_ADMIN = [
  { pos: 1, label: '헤드라인' },
  { pos: 2, label: '정치' },
  { pos: 3, label: '경제' },
  { pos: 4, label: '세계' },
  { pos: 5, label: '문화·연예' },
  { pos: 6, label: '스포츠' },
  { pos: 7, label: '사회' },
];
const DEFAULT_CHAT_SEQUENCE = [5, 3, 1, 7];
const DEFAULT_ADMIN_SEQUENCE = [7, 1, 3, 5];

export function AdminScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('home');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-1">
        {tab === 'home' && (
          <HomeView
            onLeave={() => navigation.goBack()}
            onTab={(t) => setTab(t)}
          />
        )}
        {tab === 'users' && !selectedUserId && (
          <UsersView
            onBack={() => setTab('home')}
            onOpen={(id) => setSelectedUserId(id)}
          />
        )}
        {tab === 'users' && selectedUserId && (
          <UserDetailView
            userId={selectedUserId}
            onBack={() => setSelectedUserId(null)}
          />
        )}
        {tab === 'arm' && <ArmView onBack={() => setTab('home')} />}
        {tab === 'chats' && <ChatsView onBack={() => setTab('home')} />}
      </View>
      <AdminTabBar tab={tab} onChange={(t) => { setSelectedUserId(null); setTab(t); }} />
    </SafeAreaView>
  );
}

function AdminHeader({
  title,
  leftLabel,
  onBack,
}: {
  title: string;
  leftLabel?: string;
  onBack?: () => void;
}) {
  return (
    <View
      className="flex-row items-center px-4 py-3 bg-surface"
      style={{ borderBottomWidth: 0.5, borderBottomColor: 'rgba(60,60,67,0.12)' }}
    >
      {leftLabel ? (
        <Pressable onPress={onBack} hitSlop={12}>
          <Text className="text-accent" style={{ fontSize: 17 }}>‹ {leftLabel}</Text>
        </Pressable>
      ) : null}
      <Text className="flex-1 text-center text-text" style={{ fontSize: 17, fontWeight: '700' }}>
        {title}
      </Text>
      <View className="w-12" />
    </View>
  );
}

function HomeView({ onLeave, onTab }: { onLeave: () => void; onTab: (t: Tab) => void }) {
  return (
    <View className="flex-1">
      <AdminHeader title="DailyNews · Admin" leftLabel="피드" onBack={onLeave} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-muted mb-3" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
          관리 메뉴
        </Text>
        <View className="bg-surface rounded-cardLg overflow-hidden">
          <MenuRow icon="👥" label="사용자 관리" detail="목록 / 차단 / 삭제" onTap={() => onTab('users')} />
          <Sep />
          <MenuRow icon="🔒" label="ARM 관리" detail="잠금 코드 시퀀스 per user" onTap={() => onTab('arm')} />
          <Sep />
          <MenuRow icon="💬" label="채팅 데이터" detail="페어 / 메시지 강제 삭제" onTap={() => onTab('chats')} />
        </View>
      </ScrollView>
    </View>
  );
}

function MenuRow({ icon, label, detail, onTap }: { icon: string; label: string; detail: string; onTap: () => void }) {
  return (
    <Pressable onPress={onTap} className="flex-row items-center px-4 py-4">
      <Text style={{ fontSize: 22, marginRight: 14 }}>{icon}</Text>
      <View className="flex-1">
        <Text className="text-text" style={{ fontSize: 17, fontWeight: '600' }}>
          {label}
        </Text>
        <Text className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      <Text className="text-muted" style={{ fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

function Sep() {
  return <View style={{ height: 0.5, backgroundColor: 'rgba(60,60,67,0.12)', marginLeft: 52 }} />;
}

// ─── Users ─────────────────────────────────────────────────────────────────

function UsersView({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const auth = useAuth();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await auth.getValidAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ users: AdminUserRow[] }>(
        `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        { accessToken: token },
      );
      setUsers(res.users);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [auth, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="flex-1">
      <AdminHeader title="사용자 관리" leftLabel="홈" onBack={onBack} />
      <View className="px-4 py-3 bg-surface" style={{ borderBottomWidth: 0.5, borderBottomColor: 'rgba(60,60,67,0.12)' }}>
        <TextInput
          className="bg-bg rounded-md px-3 py-2 text-text"
          style={{ fontSize: 15 }}
          placeholder="userId / 닉네임 검색"
          placeholderTextColor="#86868b"
          autoCapitalize="none"
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => void load()}
        />
      </View>
      {loading ? (
        <View className="items-center mt-12"><ActivityIndicator /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {users.map((u) => (
            <UserRow key={u.id} user={u} onTap={() => onOpen(u.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UserRow({ user, onTap }: { user: AdminUserRow; onTap: () => void }) {
  const isDeleted = user.status === 'DELETED';
  return (
    <Pressable
      onPress={onTap}
      className="bg-surface rounded-card flex-row items-center p-3 mb-2"
    >
      <View
        className="w-10 h-10 rounded-pill items-center justify-center mr-3"
        style={{ backgroundColor: '#e5e5ea' }}
      >
        <Text className="text-text" style={{ fontSize: 15, fontWeight: '700' }}>
          {user.nickname.charAt(0)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-text" style={{ fontSize: 15, fontWeight: '600' }}>
          {user.nickname}
        </Text>
        <Text className="text-muted mt-0.5" style={{ fontSize: 12 }}>
          @{user.userId} · {user.pairedWith ? `↔ @${user.pairedWith}` : '미연결'}
        </Text>
      </View>
      {isDeleted ? (
        <Text className="text-red" style={{ fontSize: 11, fontWeight: '700' }}>
          DELETED
        </Text>
      ) : null}
      <Text className="text-muted ml-2" style={{ fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

function UserDetailView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const auth = useAuth();
  const [user, setUser] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    const token = await auth.getValidAccessToken();
    if (!token) return;
    try {
      const res = await apiFetch<AdminUserRow>(`/admin/users/${userId}`, { accessToken: token });
      setUser(res);
    } catch {
      // silent
    }
  }, [auth, userId]);

  useEffect(() => { void load(); }, [load]);

  async function action(kind: 'block' | 'delete') {
    const verb = kind === 'block' ? '차단' : '삭제';
    Alert.alert(`${verb} 확인`, `${user?.nickname} 을 ${verb}하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: verb,
        style: 'destructive',
        onPress: async () => {
          const token = await auth.getValidAccessToken();
          if (!token) return;
          try {
            if (kind === 'block') {
              await apiFetch(`/admin/users/${userId}/block`, { method: 'POST', accessToken: token });
            } else {
              await apiFetch(`/admin/users/${userId}`, { method: 'DELETE', accessToken: token });
            }
            await load();
          } catch (e) {
            Alert.alert('실패', e instanceof ApiError ? e.message : '오류');
          }
        },
      },
    ]);
  }

  if (!user) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;

  return (
    <View className="flex-1">
      <AdminHeader title="사용자 상세" leftLabel="목록" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-surface rounded-cardLg p-4 items-center">
          <View
            className="w-16 h-16 rounded-pill items-center justify-center mb-3"
            style={{ backgroundColor: '#e5e5ea' }}
          >
            <Text className="text-text" style={{ fontSize: 24, fontWeight: '700' }}>
              {user.nickname.charAt(0)}
            </Text>
          </View>
          <Text className="text-text" style={{ fontSize: 20, fontWeight: '700' }}>
            {user.nickname}
          </Text>
          <Text className="text-muted mt-1" style={{ fontSize: 13 }}>
            @{user.userId}
          </Text>
        </View>

        <Text className="text-muted mt-6 mb-2 ml-3" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
          상태
        </Text>
        <View className="bg-surface rounded-cardLg overflow-hidden">
          <Field label="상태" value={user.status} />
          <Sep />
          <Field label="페어" value={user.pairedWith ? `@${user.pairedWith}` : '없음'} />
          <Sep />
          <Field label="댓글 수" value={String(user.messageCount)} />
          <Sep />
          <Field label="가입일" value={new Date(user.createdAt).toLocaleDateString('ko-KR')} />
        </View>

        <Text className="text-red mt-6 mb-2 ml-3" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
          위험 작업
        </Text>
        <View className="bg-surface rounded-cardLg overflow-hidden">
          <Pressable onPress={() => action('block')} className="py-4 items-center">
            <Text className="text-red" style={{ fontSize: 15 }}>차단</Text>
          </Pressable>
          <Sep />
          <Pressable onPress={() => action('delete')} className="py-4 items-center">
            <Text className="text-red" style={{ fontSize: 15, fontWeight: '600' }}>완전 삭제</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center px-4 py-3">
      <Text className="text-muted" style={{ fontSize: 13, width: 80 }}>
        {label}
      </Text>
      <Text className="flex-1 text-text" style={{ fontSize: 15 }}>{value}</Text>
    </View>
  );
}

// ─── ARM (시퀀스 관리) ──────────────────────────────────────────────────────

function ArmView({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1">
      <AdminHeader title="ARM 관리" leftLabel="홈" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-muted mb-3" style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>
          기본 시퀀스
        </Text>
        <View className="bg-surface rounded-cardLg overflow-hidden">
          <SequenceRow label="채팅 진입" sequence={DEFAULT_CHAT_SEQUENCE} />
          <Sep />
          <SequenceRow label="Admin 진입" sequence={DEFAULT_ADMIN_SEQUENCE} />
        </View>
        <Text className="text-muted mt-6" style={{ fontSize: 12, lineHeight: 18 }}>
          per-user 시퀀스 변경은 사용자 상세 → 시퀀스 변경 (deferred).
          현재 모든 사용자는 위 기본 시퀀스 공유.
        </Text>
      </ScrollView>
    </View>
  );
}

function SequenceRow({ label, sequence }: { label: string; sequence: number[] }) {
  return (
    <View className="px-4 py-3">
      <Text className="text-muted" style={{ fontSize: 12 }}>{label}</Text>
      <View className="flex-row mt-2 gap-2">
        {sequence.map((pos, i) => {
          const cat = CATEGORIES_ADMIN.find((c) => c.pos === pos);
          return (
            <View key={i} className="flex-row items-center">
              <View
                className="rounded-pill px-3 py-1"
                style={{ backgroundColor: '#1d1d1f' }}
              >
                <Text className="text-inverse" style={{ fontSize: 12, fontWeight: '600' }}>
                  {pos}. {cat?.label}
                </Text>
              </View>
              {i < sequence.length - 1 ? (
                <Text className="text-muted mx-1" style={{ fontSize: 14 }}>→</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Chats ─────────────────────────────────────────────────────────────────

function ChatsView({ onBack }: { onBack: () => void }) {
  const auth = useAuth();
  const [chats, setChats] = useState<AdminChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await auth.getValidAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ chats: AdminChatRow[] }>('/admin/chats', { accessToken: token });
      setChats(res.chats);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => { void load(); }, [load]);

  async function remove(pairingId: string) {
    Alert.alert('채팅방 삭제', '메시지 전체 삭제 + 페어 해제. 복구 불가.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          const token = await auth.getValidAccessToken();
          if (!token) return;
          try {
            await apiFetch(`/admin/chats/${pairingId}`, { method: 'DELETE', accessToken: token });
            await load();
          } catch (e) {
            Alert.alert('실패', e instanceof ApiError ? e.message : '오류');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1">
      <AdminHeader title="채팅 데이터" leftLabel="홈" onBack={onBack} />
      {loading ? (
        <View className="items-center mt-12"><ActivityIndicator /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {chats.map((c) => (
            <View key={c.pairingId} className="bg-surface rounded-card p-3 mb-2">
              <View className="flex-row items-center">
                <Text className="text-text flex-1" style={{ fontSize: 15, fontWeight: '600' }}>
                  @{c.a.userId} ↔ @{c.b.userId}
                </Text>
                <Text className="text-muted" style={{ fontSize: 11, fontWeight: '700' }}>
                  {c.status}
                </Text>
              </View>
              <Text className="text-muted mt-1" style={{ fontSize: 12 }}>
                댓글 {c.messageCount}개 · {c.lastMessageAt ? `최근 ${new Date(c.lastMessageAt).toLocaleString('ko-KR')}` : '메시지 없음'}
              </Text>
              <Pressable onPress={() => remove(c.pairingId)} className="mt-3">
                <Text className="text-red" style={{ fontSize: 13, fontWeight: '600' }}>삭제</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Tab bar ───────────────────────────────────────────────────────────────

function AdminTabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'home', label: '홈', icon: '🏠' },
    { id: 'users', label: '사용자', icon: '👥' },
    { id: 'arm', label: 'ARM', icon: '🔒' },
    { id: 'chats', label: '채팅', icon: '💬' },
  ];
  return (
    <View
      className="flex-row justify-around bg-surface"
      style={{
        paddingTop: 10,
        paddingBottom: 22,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(60,60,67,0.12)',
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <Pressable key={t.id} onPress={() => onChange(t.id)} className="items-center">
            <Text style={{ fontSize: 20, opacity: active ? 1 : 0.4 }}>{t.icon}</Text>
            <Text
              style={{
                fontSize: 10,
                marginTop: 2,
                fontWeight: active ? '700' : '500',
                color: active ? '#007aff' : '#86868b',
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
