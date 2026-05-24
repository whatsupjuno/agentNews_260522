import './global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/store/auth';
import { UnlockProvider } from './src/store/unlock';

function AppShell() {
  const auth = useAuth();
  if (auth.status === 'loading') {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator size="large" color="#007aff" />
      </View>
    );
  }
  return <RootNavigator isAuthenticated={auth.status === 'authenticated'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UnlockProvider>
          <NavigationContainer>
            <AppShell />
            <StatusBar style="dark" />
          </NavigationContainer>
        </UnlockProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
