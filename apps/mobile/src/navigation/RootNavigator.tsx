import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { NewsFeedScreen } from '../screens/NewsFeedScreen';
import { ArticleDetailScreen } from '../screens/ArticleDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { AdminScreen } from '../screens/AdminScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  NewsFeed: undefined;
  ArticleDetail: { articleId: string; mode?: 'normal' | 'chat' };
  Settings: undefined;
  ProfileEdit: undefined;
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  isAuthenticated: boolean;
}

export function RootNavigator({ isAuthenticated }: Props) {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen name="NewsFeed" component={NewsFeedScreen} />
          <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'none' }}
          />
          <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
