import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';
import { esquecerPush } from '@/services/push';
import type { Profile, UserRole } from '@/types/database';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** Ainda restaurando a sessão salva no dispositivo. */
  initializing: boolean;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    // Nunca propaga: uma falha de rede aqui não pode derrubar a
    // inicialização do app (o resultado seria splash infinito).
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[auth] falha ao carregar profile:', error.message);
        return;
      }
      setProfile(data);
    } catch (e) {
      console.warn('[auth] erro de rede ao carregar profile:', e);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // O `finally` é essencial: `initializing` PRECISA terminar em qualquer
    // cenário. Sem ele, uma rejeição deixa o app preso na splash screen
    // para sempre, sem mensagem nenhuma.
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        }
      } catch (e) {
        console.warn('[auth] falha ao restaurar a sessão:', e);
      } finally {
        if (active) setInitializing(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(traduzErroAuth(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim(), role: 'cliente' } },
    });
    if (error) throw new Error(traduzErroAuth(error.message));
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    // Para onde o link do email deve voltar.
    //
    // No navegador, a própria origem. No celular, o esquema do aplicativo —
    // e isso não é detalhe: sem `redirectTo`, o Supabase usa a Site URL do
    // projeto, que é o site. O técnico abria o link no celular, caía no site
    // e nunca chegava à tela de nova senha, porque o evento PASSWORD_RECOVERY
    // acontecia no navegador e não no aplicativo onde ele estava.
    const redirectTo =
      Platform.OS === 'web'
        ? `${window.location.origin}/recuperar-senha`
        : Linking.createURL('/recuperar-senha');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
    if (error) throw new Error(traduzErroAuth(error.message));
  }, []);

  const signOut = useCallback(async () => {
    // Antes de limpar a sessão: o token de push é endereço de entrega e
    // não pode ficar apontando para quem saiu — num tablet compartilhado,
    // seria entregar chamado de um técnico ao próximo que entrar.
    await esquecerPush();

    // Limpa o estado primeiro para o AuthGate retirar o usuário das rotas protegidas,
    // mesmo se a rede estiver instável durante a revogação remota.
    setSession(null);
    setProfile(null);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error(traduzErroAuth(error.message));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      initializing,
      role: profile?.role ?? null,
      signIn,
      signUp,
      resetPassword,
      signOut,
      refreshProfile,
    }),
    [session, profile, initializing, signIn, signUp, resetPassword, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}

/** O Supabase devolve mensagens em inglês; a interface é toda pt-BR. */
function traduzErroAuth(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('user already registered')) return 'Este e-mail já está cadastrado.';
  if (m.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (m.includes('unable to validate email')) return 'E-mail inválido.';
  if (m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.';
  return message;
}
