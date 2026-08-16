import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/**
 * Mantém a navegação alinhada à sessão: sem login, só o grupo (auth);
 * com login, o app do perfil.
 */
function AuthGate() {
  const { session, initializing, role } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const inTechnicianGroup = segments[0] === '(tecnico)';
    const destination = role === 'admin' ? '/(admin)' : role === 'tecnico' ? '/(tecnico)' : '/(cliente)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && (inAuthGroup || (role === 'admin' && !inAdminGroup) || (role === 'tecnico' && !inTechnicianGroup) || (role === 'cliente' && (inAdminGroup || inTechnicianGroup)))) {
      router.replace(destination);
    }
  }, [session, initializing, role, segments, router]);

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(cliente)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(tecnico)" />
      <Stack.Screen name="chamado/novo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chamado/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
