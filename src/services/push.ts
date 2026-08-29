import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Aviso no celular com o aplicativo fechado.
 *
 * O envio sai do banco (ver 0027): quando uma notificação é gravada, um
 * gatilho entrega no serviço da Expo usando os tokens registrados aqui.
 * Este arquivo cuida só das duas pontas do aparelho — pegar o endereço de
 * entrega e devolvê-lo quando a pessoa sai.
 */

/** Com o app aberto, o aviso ainda aparece: quem está em outra tela precisa ver. */
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }) as Notifications.NotificationBehavior,
});

/** Token deste aparelho, guardado para poder ser removido na saída. */
let tokenAtual: string | null = null;

function idDoProjeto(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

/**
 * Registra o aparelho para receber avisos.
 *
 * Silencioso de propósito: se a pessoa recusar a permissão, ou estiver no
 * navegador, ou num emulador, o resto do sistema segue igual. Push é
 * conveniência — a notificação continua na central de qualquer forma.
 */
export async function registrarPush(profileId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    // O canal precisa existir antes do primeiro aviso, senão o Android
    // entrega tudo em silêncio e sem vibrar.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avisos do sistema',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#006BFF',
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    let concedida = atual.granted;
    if (!concedida && atual.canAskAgain) {
      concedida = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!concedida) return;

    const projectId = idDoProjeto();
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    tokenAtual = token;

    const { error } = await (supabase as any).from('push_tokens').upsert(
      {
        token,
        profile_id: profileId,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) {
      console.warn('[push] endereco de entrega nao foi salvo:', error.message);
      return;
    }
    console.log('[push] aparelho registrado:', token);
  } catch (erro) {
    // Falha aqui nao pode atrapalhar a abertura do aplicativo. Mas sumir em
    // silencio e pior: sem token nao chega aviso nenhum e ninguem descobre
    // por que. O aplicativo segue; o motivo fica no log.
    console.warn('[push] nao foi possivel registrar este aparelho:', erro);
  }
}

/**
 * Devolve o endereço de entrega ao sair.
 *
 * Não é limpeza cosmética: sem isso, o próximo a entrar neste aparelho
 * receberia os avisos de quem saiu. Num tablet compartilhado pela equipe,
 * seria vazar chamado de um técnico para outro.
 */
export async function esquecerPush(): Promise<void> {
  if (!tokenAtual) return;
  try {
    await (supabase as any).from('push_tokens').delete().eq('token', tokenAtual);
  } catch {
    // Se falhar, o token some no próximo registro de outro perfil.
  } finally {
    tokenAtual = null;
  }
}

/** Para onde levar quando a pessoa toca no aviso. */
export function destinoDoAviso(dados: Record<string, unknown> | undefined): string | null {
  if (!dados) return null;
  const tipo = typeof dados.entity_type === 'string' ? dados.entity_type : null;
  const id = typeof dados.entity_id === 'string' ? dados.entity_id : null;

  if (tipo === 'chamado' && id) return `/chamado/${id}`;
  if (tipo === 'estoque') return '/(admin)/estoque';
  if (tipo === 'pedido') return '/(admin)/recebimento';
  return '/notificacoes';
}

/** Ouve o toque no aviso. Devolve a função que cancela a escuta. */
export function ouvirToqueNoAviso(aoTocar: (destino: string) => void): () => void {
  const inscricao = Notifications.addNotificationResponseReceivedListener((resposta) => {
    const dados = resposta.notification.request.content.data as Record<string, unknown>;
    const destino = destinoDoAviso(dados);
    if (destino) aoTocar(destino);
  });
  return () => inscricao.remove();
}
