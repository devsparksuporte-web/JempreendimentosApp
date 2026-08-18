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
import { ActivityIndicator, StyleSheet, Text as NativeText, Vibration, View } from 'react-native';
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

  if (initializing || !onboardingReady) return <StartupLoader />;

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

function StartupLoader() {
  return <View style={loaderStyles.root}><View style={loaderStyles.mark}><View style={loaderStyles.markBar} /><View style={[loaderStyles.markBar, loaderStyles.markBarShort]} /><View style={loaderStyles.markBar} /></View><NativeText style={loaderStyles.title}>JEMPREENDIMENTOS</NativeText><NativeText style={loaderStyles.subtitle}>CLIMATIZAÇÃO E SERVIÇOS</NativeText><ActivityIndicator size="small" color="#8FD8FF" style={loaderStyles.indicator} /></View>;
}

const loaderStyles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandStrong }, mark: { height: 42, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginBottom: 18 }, markBar: { width: 10, height: 42, borderRadius: 5, backgroundColor: colors.brandSoft }, markBarShort: { height: 27, backgroundColor: colors.brand }, title: { color: colors.bgSurface, fontSize: 19, fontWeight: '800', letterSpacing: 2.4 }, subtitle: { marginTop: 7, color: colors.brandSoft, fontSize: 10, fontWeight: '600', letterSpacing: 2.1 }, indicator: { marginTop: 28 } });

/**
 * Prazo máximo de espera pelas fontes. Passado isso o app abre com a fonte
 * do sistema — tipografia é cosmético, travar na splash não é.
 */
const FONT_TIMEOUT_MS = 5000;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontError) console.warn('[fontes] falha ao carregar, seguindo com a do sistema:', fontError);
  }, [fontError]);

  // Nunca depender só de `fontsLoaded`: um erro ou uma pendência eterna
  // deixaria o app preso na splash screen sem nenhuma mensagem.
  const ready = fontsLoaded || Boolean(fontError) || fontTimedOut;

  // A splash sai daqui, o ponto mais alto da árvore. Antes isso vivia dentro
  // do AuthGate, que só monta depois das fontes — se elas falhassem, ninguém
  // escondia a splash.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <StartupLoader />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
