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
import { Platform, Vibration } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { carregarOnboarding, useOnboarding } from '@/lib/onboarding';
import { carregarAssistentePermissoes, useAssistentePermissoes } from '@/lib/permissoes';
import { incrementarNaoLidas, recarregarNaoLidas } from '@/lib/naoLidas';
import { subscribeToNotifications } from '@/services/notifications';
import { ouvirToqueNoAviso, registrarPush } from '@/services/push';
import { Abertura } from '@/components/Abertura';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/**
 * Mantém a navegação alinhada à sessão: sem login, só o grupo (auth);
 * com login, o app do perfil.
 */
function AuthGate() {
  const { session, initializing, role } = useAuth();
  const { carregado: onboardingReady, concluido: onboardingDone } = useOnboarding();
  const { carregado: permissoesReady, concluido: permissoesDone } = useAssistentePermissoes();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void carregarOnboarding();
    void carregarAssistentePermissoes();
  }, []);

  /**
   * Push: registra o aparelho e escuta o toque no aviso.
   *
   * Separado da escuta em tempo real porque resolve o caso oposto — a
   * notificação em tempo real serve a quem está com o app aberto; o push
   * serve a quem não está.
   */
  useEffect(() => {
    const perfil = session?.user.id;
    if (!perfil) return;

    void registrarPush(perfil);
    return ouvirToqueNoAviso((destino) => router.push(destino as never));
  }, [session?.user.id, router]);

  useEffect(() => {
    if (!session?.user.id) return;
    void recarregarNaoLidas();

    return subscribeToNotifications(session.user.id, (nova) => {
      incrementarNaoLidas();

      // O padrão da vibração carrega a urgência: três toques longos para
      // urgente, dois médios para alta, um curto para o resto. Tremer igual
      // para tudo faz o aparelho virar ruído de fundo.
      const padrao =
        nova.priority === 'urgent'
          ? [0, 300, 120, 300, 120, 300]
          : nova.priority === 'high'
            ? [0, 180, 80, 180]
            : [0, 120];

      Vibration.vibrate(padrao);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(padrao.slice(1));
      }
    });
  }, [session?.user.id]);

  useEffect(() => {
    if (initializing || !onboardingReady || !permissoesReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = inAuthGroup && (segments as string[])[1] === 'onboarding';
    const inPermissoes = inAuthGroup && (segments as string[])[1] === 'permissoes';

    // A recuperação de senha é destino de link de email: a pessoa chega
    // com o token na URL, quase sempre num navegador que nunca abriu este
    // app. Mandá-la para o onboarding descarta o token e o link morre —
    // e ela nunca entende por quê, porque a tela que aparece é bonita e
    // não diz que algo se perdeu.
    const inRecuperarSenha = inAuthGroup && (segments as string[])[1] === 'recuperar-senha';

    // No navegador o site da empresa é a apresentação: quem clicou em
    // "Entrar no sistema" quer o formulário de login, não três telas de
    // boas-vindas. O onboarding é ritual de primeira abertura de
    // aplicativo, e no web ele só atrasa quem já decidiu entrar.
    const apresentacaoOk = onboardingDone || Platform.OS === 'web';
    const inAdminGroup = segments[0] === '(admin)';
    const inTechnicianGroup = segments[0] === '(tecnico)';

    // Telas na raiz não pertencem a perfil nenhum: a central de
    // notificações e o chamado são as mesmas para quem quer que esteja
    // logado. Sem esta exceção o administrador é devolvido para
    // `(admin)` no mesmo instante em que abre o sino, e a tela pisca sem
    // dizer por quê. Quem decide o que cada um enxerga é a RLS, não isto
    // aqui — isto é só para onde a navegação leva.
    const emRotaCompartilhada = ['notificacoes', 'chamado', 'trocar-senha', 'agenda', 'agendar', 'editar-perfil'].includes(
      (segments as string[])[0],
    );
    // No navegador o técnico é mandado para uma tela de aviso, e não para o
    // painel dele. O trabalho de campo depende de câmera, GPS e da mão do
    // cliente na tela — nada disso existe num monitor, e um técnico que
    // entra e não acha o leitor de QR conclui que o sistema quebrou.
    // Isto é orientação de uso; quem barra acesso a dado é a RLS.
    const tecnicoNoNavegador = Platform.OS === 'web' && role === 'tecnico';
    const noAvisoDoApp = (segments as string[])[0] === 'acesso-pelo-app';

    // No navegador o destino é `/inicio`, não a raiz do grupo: a raiz resolve
    // para a URL `/`, e `/` no domínio publicado é o site institucional. Sem
    // isto, entrar no sistema deixava a barra de endereços em `/` — e o
    // primeiro F5 jogava a pessoa para fora, na página de vendas.
    const inicioDoPerfil =
      role === 'admin' ? '/(admin)' : role === 'tecnico' ? '/(tecnico)' : '/(cliente)';

    const destination = tecnicoNoNavegador
      ? '/acesso-pelo-app'
      : Platform.OS === 'web'
        ? `${inicioDoPerfil}/inicio`
        : inicioDoPerfil;

    // A ordem é: apresentação, permissões, login. Cada etapa só sai do
    // caminho depois de concluída, e quem já entrou nunca mais as vê.
    if (inRecuperarSenha) {
      return;
    } else if (!apresentacaoOk && !inOnboarding) {
      router.replace('/(auth)/onboarding' as never);
    } else if (apresentacaoOk && !permissoesDone && !session && !inPermissoes) {
      router.replace('/(auth)/permissoes' as never);
    } else if (apresentacaoOk && permissoesDone && !session && (!inAuthGroup || inOnboarding || inPermissoes)) {
      router.replace('/(auth)/login');
    } else if (session && tecnicoNoNavegador && !noAvisoDoApp) {
      router.replace('/acesso-pelo-app' as never);
    } else if (
      session &&
      !emRotaCompartilhada &&
      // A tela de aviso só retém quem ela existe para atender. Qualquer
      // outro perfil que caia nela é devolvido ao painel dele, em vez de
      // ficar preso num aviso que não é sobre ele.
      !(noAvisoDoApp && tecnicoNoNavegador) &&
      (inAuthGroup ||
        (role === 'admin' && !inAdminGroup) ||
        (role === 'tecnico' && !inTechnicianGroup) ||
        (role === 'cliente' && (inAdminGroup || inTechnicianGroup)))
    ) {
      router.replace(destination as never);
    }
  }, [session, initializing, role, segments, router, onboardingReady, onboardingDone, permissoesReady, permissoesDone]);

  if (initializing || !onboardingReady || !permissoesReady) return <Abertura />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgApp } }}>
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(auth)/onboarding" />
      <Stack.Screen name="(auth)/permissoes" />
      <Stack.Screen name="(auth)/recuperar-senha" />
      <Stack.Screen name="trocar-senha" />
      <Stack.Screen name="editar-perfil" />
      <Stack.Screen name="agenda" />
      <Stack.Screen name="acesso-pelo-app" />
      <Stack.Screen name="(cliente)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(tecnico)" />
      <Stack.Screen name="chamado/novo" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chamado/[id]" />
    </Stack>
  );
}


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

  if (!ready) return <Abertura />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
