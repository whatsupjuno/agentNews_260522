import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SequenceResetScreen } from '../screens/SequenceResetScreen';
import { NewsFeedScreen } from '../screens/NewsFeedScreen';
import { ArticleDetailScreen } from '../screens/ArticleDetailScreen';
import { PairingSearchScreen } from '../screens/PairingSearchScreen';
import { PairingRequestScreen } from '../screens/PairingRequestScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { SequenceChangeScreen } from '../screens/SequenceChangeScreen';
import { SequenceResetRequestScreen } from '../screens/SequenceResetRequestScreen';
import { PairDisconnectScreen } from '../screens/PairDisconnectScreen';

/**
 * RN Navigation Stack — 13 스크린.
 * 위장 원칙: 채팅용 별도 ChatScreen 명명 금지. ArticleDetailScreen 내부에서
 * unlock_token + PAIRED 상태일 때 conditional swap.
 */
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  SequenceReset: { token: string } | undefined;
  NewsFeed: undefined;
  ArticleDetail: { articleId: string; feedIndex: number };
  PairingSearch: undefined;
  PairingRequest: { pairingId: string };
  Settings: undefined;
  ProfileEdit: undefined;
  SequenceChange: undefined;
  SequenceResetRequest: undefined;
  PairDisconnect: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // REQ-024: 앱 재시작 시 항상 NewsFeed 부터. 자동 로그인 토큰 검증은 LoginScreen 내부에서.
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="SequenceReset" component={SequenceResetScreen} />
      <Stack.Screen name="NewsFeed" component={NewsFeedScreen} />
      <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
      <Stack.Screen name="PairingSearch" component={PairingSearchScreen} />
      <Stack.Screen name="PairingRequest" component={PairingRequestScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="SequenceChange" component={SequenceChangeScreen} />
      <Stack.Screen name="SequenceResetRequest" component={SequenceResetRequestScreen} />
      <Stack.Screen name="PairDisconnect" component={PairDisconnectScreen} />
    </Stack.Navigator>
  );
}
