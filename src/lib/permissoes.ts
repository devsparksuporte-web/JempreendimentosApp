import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';

/**
 * Gerenciador central de permissões.
 *
 * Só entram aqui permissões com funcionalidade real por trás. O app hoje usa
 * câmera (foto de evidência e leitura de QR), localização em primeiro plano
 * (posição do técnico e rota no mapa) e biblioteca de mídia (anexar foto da
 * galeria).
 *
 * Ficaram DE FORA de propósito:
 *
 * - Notificações: as do app são internas, via Supabase Realtime na tabela
 *   `notifications`. Nada dispara notificação do sistema operacional, então
 *   não há POST_NOTIFICATIONS a pedir. Quando o push entrar (expo-notifications,
 *   que exige build nativa nova), basta acrescentar uma entrada em CATALOGO.
 * - Contatos: nenhuma tela lê a agenda do aparelho.
 * - Microfone: nenhuma função grava áudio.
 *
 * Pedir qualquer uma delas hoje seria pedir acesso sem uso — o tipo de coisa
 * que derruba app em revisão de loja e corrói a confiança de quem instala.
 */

export type ChavePermissao = 'camera' | 'localizacao' | 'midia';

/**
 * `bloqueado` é diferente de `negado`: o Android já não deixa perguntar de
 * novo pelo diálogo, e o único caminho é a tela de configurações do app.
 */
export type StatusPermissao = 'pendente' | 'permitido' | 'negado' | 'bloqueado';

export type ItemPermissao = {
  chave: ChavePermissao;
  titulo: string;
  /** Frase curta da lista. */
  resumo: string;
  /** Explicação mostrada no passo de solicitação. */
  motivo: string;
  /** Sem ela, o que deixa de funcionar. */
  consequencia: string;
};

export const CATALOGO: ItemPermissao[] = [
  {
    chave: 'camera',
    titulo: 'Câmera',
    resumo: 'Fotos dos equipamentos e leitura de QR Code',
    motivo:
      'A câmera registra as evidências obrigatórias do atendimento — antes, durante e depois — e lê o QR Code colado no equipamento.',
    consequencia: 'Sem ela não dá para registrar evidência nem abrir equipamento pelo QR Code.',
  },
  {
    chave: 'localizacao',
    titulo: 'Localização',
    resumo: 'Rota até o atendimento e posição da equipe',
    motivo:
      'A localização traça a rota até o endereço do chamado e mostra a equipe em campo no painel da operação. É usada só com o aplicativo aberto.',
    consequencia: 'Sem ela o mapa não centraliza em você e a rota parte de um ponto genérico.',
  },
  {
    chave: 'midia',
    titulo: 'Fotos e arquivos',
    resumo: 'Anexar imagens já salvas no aparelho',
    motivo:
      'Serve para anexar ao atendimento uma foto que já está no aparelho, quando não dá para fotografar na hora.',
    consequencia: 'Sem ela resta apenas a câmera para registrar evidência.',
  },
];

// ---------------------------------------------------------------------------
// Consulta e solicitação, uma função por permissão
// ---------------------------------------------------------------------------

/** Traduz a resposta do Expo para o nosso vocabulário de status. */
function traduzir(resposta: {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}): StatusPermissao {
  if (resposta.granted) return 'permitido';
  if (resposta.status === 'undetermined') return 'pendente';
  return resposta.canAskAgain ? 'negado' : 'bloqueado';
}

export async function checkCameraPermission(): Promise<StatusPermissao> {
  return traduzir(await ImagePicker.getCameraPermissionsAsync());
}

export async function requestCameraPermission(): Promise<StatusPermissao> {
  return traduzir(await ImagePicker.requestCameraPermissionsAsync());
}

export async function checkLocationPermission(): Promise<StatusPermissao> {
  return traduzir(await Location.getForegroundPermissionsAsync());
}

export async function requestLocationPermission(): Promise<StatusPermissao> {
  return traduzir(await Location.requestForegroundPermissionsAsync());
}

/**
 * Biblioteca de mídia.
 *
 * `writeOnly: false` pede só leitura. No Android 13+ isso vira
 * READ_MEDIA_IMAGES em vez do antigo READ_EXTERNAL_STORAGE, e o próprio
 * seletor de fotos do sistema dispensa permissão em boa parte dos casos — o
 * expo-image-picker resolve essa diferença por versão.
 */
export async function checkMediaPermission(): Promise<StatusPermissao> {
  return traduzir(await ImagePicker.getMediaLibraryPermissionsAsync(false));
}

export async function requestMediaPermission(): Promise<StatusPermissao> {
  return traduzir(await ImagePicker.requestMediaLibraryPermissionsAsync(false));
}

const CONSULTAS: Record<ChavePermissao, () => Promise<StatusPermissao>> = {
  camera: checkCameraPermission,
  localizacao: checkLocationPermission,
  midia: checkMediaPermission,
};

const PEDIDOS: Record<ChavePermissao, () => Promise<StatusPermissao>> = {
  camera: requestCameraPermission,
  localizacao: requestLocationPermission,
  midia: requestMediaPermission,
};

export async function consultar(chave: ChavePermissao): Promise<StatusPermissao> {
  try {
    return await CONSULTAS[chave]();
  } catch {
    return 'pendente';
  }
}

export async function solicitar(chave: ChavePermissao): Promise<StatusPermissao> {
  try {
    return await PEDIDOS[chave]();
  } catch {
    return 'negado';
  }
}

export async function consultarTodas(): Promise<Record<ChavePermissao, StatusPermissao>> {
  const pares = await Promise.all(
    CATALOGO.map(async (item) => [item.chave, await consultar(item.chave)] as const),
  );
  return Object.fromEntries(pares) as Record<ChavePermissao, StatusPermissao>;
}

/** Leva às configurações do app, único caminho quando o status é `bloqueado`. */
export async function abrirConfiguracoes(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Em plataformas sem tela de configurações do app não há o que fazer.
  }
}

// ---------------------------------------------------------------------------
// Verificação no momento do uso
// ---------------------------------------------------------------------------

export type ResultadoGarantia = {
  ok: boolean;
  status: StatusPermissao;
  /** Mensagem pronta para mostrar quando `ok` é falso. */
  mensagem: string | null;
  /** Verdadeiro quando só as configurações do sistema resolvem. */
  precisaConfiguracoes: boolean;
};

/**
 * Confere a permissão na hora de usar o recurso, e pede se ainda der.
 *
 * O assistente inicial não vale como garantia permanente: o usuário pode
 * revogar a permissão nas configurações do Android a qualquer momento, e aí
 * o app precisa perceber e reagir onde o recurso é acionado.
 */
export async function garantirPermissao(chave: ChavePermissao): Promise<ResultadoGarantia> {
  const item = CATALOGO.find((i) => i.chave === chave)!;

  let status = await consultar(chave);
  if (status === 'pendente' || status === 'negado') {
    status = await solicitar(chave);
  }

  if (status === 'permitido') {
    return { ok: true, status, mensagem: null, precisaConfiguracoes: false };
  }

  if (status === 'bloqueado') {
    return {
      ok: false,
      status,
      mensagem: `A permissão de ${item.titulo.toLowerCase()} está bloqueada. Para habilitar, abra as configurações do aplicativo.`,
      precisaConfiguracoes: true,
    };
  }

  return {
    ok: false,
    status,
    mensagem: `${item.consequencia} Você pode permitir quando quiser.`,
    precisaConfiguracoes: false,
  };
}

// ---------------------------------------------------------------------------
// Estado do assistente inicial
//
// Compartilhado pelo mesmo motivo do onboarding: a tela grava a conclusão e
// navega em seguida, e o portão de rotas precisa enxergar a mudança no mesmo
// instante — senão devolve o usuário para o assistente num laço.
// ---------------------------------------------------------------------------

const CHAVE_ARMAZENAMENTO = 'permissions_setup_completed';

export type EstadoAssistente = {
  /** Antes de saber a resposta não dá para decidir a rota. */
  carregado: boolean;
  concluido: boolean;
};

let estado: EstadoAssistente = { carregado: false, concluido: false };
const ouvintes = new Set<() => void>();

function definir(novo: EstadoAssistente) {
  estado = novo;
  ouvintes.forEach((avisar) => avisar());
}

export async function carregarAssistentePermissoes(): Promise<void> {
  // Fora do Android não há assistente a exibir: iOS pede no momento do uso e
  // no web o navegador tem o próprio fluxo.
  if (Platform.OS !== 'android') {
    definir({ carregado: true, concluido: true });
    return;
  }
  try {
    const valor = await AsyncStorage.getItem(CHAVE_ARMAZENAMENTO);
    definir({ carregado: true, concluido: valor === 'true' });
  } catch {
    // Falha de leitura não pode travar a abertura. Mostrar o assistente de
    // novo é chato; travar o app é pior.
    definir({ carregado: true, concluido: false });
  }
}

export async function concluirAssistentePermissoes(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_ARMAZENAMENTO, 'true');
  } catch {
    // Sem persistir, o assistente reaparece na próxima abertura. Seguir em
    // frente nesta sessão continua sendo o certo.
  }
  definir({ carregado: true, concluido: true });
}

/** Reexibe o assistente — útil para testar o fluxo do zero. */
export async function reiniciarAssistentePermissoes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE_ARMAZENAMENTO);
  } catch {
    /* ignora */
  }
  definir({ carregado: true, concluido: false });
}

export function useAssistentePermissoes(): EstadoAssistente {
  return useSyncExternalStore(
    (aoMudar) => {
      ouvintes.add(aoMudar);
      return () => {
        ouvintes.delete(aoMudar);
      };
    },
    () => estado,
    () => estado,
  );
}
