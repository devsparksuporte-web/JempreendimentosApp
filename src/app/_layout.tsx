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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { subscribeToNotifications } from '@/services/notifications';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/**
 * Mantém a navegação alinhada à sessão: sem login, só o grupo (auth);
 * com login, o app do perfil.
 */
function AuthGate() {
  const { session, initializing, role } = useAuth();
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('jempreendimentos.onboarding.completed').then((value) => { setOnboardingDone(value === '1'); setOnboardingReady(true); }).catch(() => setOnboardingReady(true));
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    return subscribeToNotifications(session.user.id, () => {
      Vibration.vibrate([0, 180, 80, 180]);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([180, 80, 180]);
    });
  }, [session?.user.id]);

  useEffect(() => {
    if (initializing || !onboardingReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = inAuthGroup && (segments as string[])[1] === 'onboarding';
    const inAdminGroup = segments[0] === '(admin)';
    const inTechnicianGroup = segments[0] === '(tecnico)';
    const destination = role === 'admin' ? '/(admin)' : role === 'tecnico' ? '/(tecnico)' : '/(cliente)';

    if (!onboardingDone && !inOnboarding) {
      router.replace('/(auth)/onboarding' as never);
    } else if (onboardingDone && !session && (!inAuthGroup || inOnboarding)) {
      router.replace('/(auth)/login');
    } else if (session && (inAuthGroup || (role === 'admin' && !inAdminGroup) || (role === 'tecnico' && !inTechnicianGroup) || (role === 'cliente' && (inAdminGroup || inTechnicianGroup)))) {
      router.replace(destination);
    }
  }, [session, initializing, role, segments, router, onboardingReady, onboardingDone]);

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing || !onboardingReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/onboarding" />
      <Stack.Screen name="(auth)/recuperar-senha" />
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
