import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Entrar pela digital.
 *
 * O que fica guardado é o token de renovação da sessão, não a senha. A
 * diferença importa: senha a pessoa costuma repetir em outros serviços, e
 * um aparelho perdido viraria problema fora daqui. Token de renovação vale
 * só para este sistema e pode ser revogado no Supabase sem que ninguém
 * precise trocar de senha.
 *
 * Ele mora no SecureStore, que no Android é o Keystore do sistema — não é
 * o AsyncStorage, que é um arquivo comum lido por qualquer backup.
 *
 * A digital não desbloqueia o token por criptografia; ela é a tranca da
 * porta. Isso é honesto sobre o que a biometria do Android entrega: quem
 * tiver o aparelho destravado e ferramentas de root alcança o Keystore de
 * qualquer forma. O ganho real é não digitar senha em campo, com luva, na
 * frente do cliente.
 */

const CHAVE = 'jempreendimentos.acesso';

/** Só faz sentido oferecer se o aparelho tem leitor E alguém cadastrou digital. */
export async function biometriaDisponivel(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const temHardware = await LocalAuthentication.hasHardwareAsync();
    if (!temHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function temAcessoGuardado(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await SecureStore.getItemAsync(CHAVE)) !== null;
  } catch {
    return false;
  }
}

/** Guarda o acesso depois de um login bem-sucedido, quando a pessoa pediu. */
export async function guardarAcesso(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.refresh_token;
    if (!token) return;
    await SecureStore.setItemAsync(CHAVE, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // Não poder guardar não pode impedir a pessoa de usar o aplicativo.
  }
}

/**
 * Apaga o acesso guardado.
 *
 * Chamado na saída pelo mesmo motivo do token de push: num tablet
 * compartilhado pela equipe, deixar isso para trás entregaria a conta de um
 * técnico ao próximo que encostasse o dedo.
 */
export async function esquecerAcesso(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(CHAVE);
  } catch {
    // Se falhar, o próximo login sobrescreve.
  }
}

/**
 * Pede a digital e reabre a sessão.
 *
 * Devolve `false` quando a pessoa cancela — isso não é erro e não deve
 * virar mensagem vermelha na tela. Erro é o token ter sido revogado, e aí a
 * função limpa o que estava guardado para não insistir num acesso morto.
 */
export async function entrarComBiometria(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(CHAVE);
  if (!token) return false;

  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Entrar no JEmpreendimentos',
    cancelLabel: 'Usar senha',
    disableDeviceFallback: false,
  });
  if (!resultado.success) return false;

  const { error } = await supabase.auth.refreshSession({ refresh_token: token });
  if (error) {
    await esquecerAcesso();
    throw new Error('Seu acesso salvo expirou. Entre com email e senha.');
  }
  return true;
}
