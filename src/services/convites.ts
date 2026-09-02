import { Platform } from 'react-native';
import * as LinkDoSistema from 'expo-linking';

import { supabase } from '@/lib/supabase';

/**
 * Convite de acesso.
 *
 * Chama a função `convidar-acesso`, que roda no servidor porque criar conta
 * exige a chave de serviço do Supabase — e essa chave nunca pode estar no
 * aplicativo. O `invoke` já manda a credencial de quem está logado, e é
 * contra ela que o servidor confere se quem convida é administrador.
 *
 * O link do email leva para a tela de recuperação de senha. É a mesma
 * jornada: a pessoa chega sem senha, define a dela e entra. Não valia uma
 * segunda tela quase idêntica só para dizer "bem-vindo".
 */
export async function convidarAcesso(email: string, nome?: string): Promise<void> {
  const redirectTo =
    Platform.OS === 'web'
      ? `${window.location.origin}/recuperar-senha`
      : LinkDoSistema.createURL('/recuperar-senha');

  const { error } = await supabase.functions.invoke('convidar-acesso', {
    body: { email: email.trim().toLowerCase(), nome: nome?.trim() || undefined, redirectTo },
  });

  if (!error) return;

  // A função devolve o motivo em português no corpo da resposta. O erro que
  // chega aqui só diz que houve falha; sem abrir o corpo, a tela mostraria
  // "Edge Function returned a non-2xx status code", que não ajuda ninguém.
  const contexto = (error as { context?: Response }).context;
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = (await contexto.json()) as { erro?: string };
      if (corpo?.erro) throw new Error(corpo.erro);
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.includes('JSON')) throw e;
    }
  }
  throw new Error(error.message || 'Não foi possível enviar o convite.');
}
