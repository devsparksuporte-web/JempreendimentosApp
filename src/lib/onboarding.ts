import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Estado da apresentação inicial.
 *
 * Precisa ser compartilhado, e não estado local do AuthGate: a tela de
 * onboarding grava a conclusão e navega em seguida, então o portão de rotas
 * tem de enxergar a mudança no mesmo instante. Lendo o AsyncStorage só na
 * montagem, ele continuava achando que o onboarding não havia terminado e
 * devolvia o usuário para lá — um laço infinito entre as duas telas.
 */

const CHAVE = 'jempreendimentos.onboarding.completed';

export type EstadoOnboarding = {
  /** Já sabemos a resposta? Antes disso não dá para decidir a rota. */
  carregado: boolean;
  concluido: boolean;
};

let estado: EstadoOnboarding = { carregado: false, concluido: false };
const ouvintes = new Set<() => void>();

function definir(novo: EstadoOnboarding) {
  estado = novo;
  ouvintes.forEach((avisar) => avisar());
}

/** Lê o valor salvo. Chamado uma vez, na abertura do app. */
export async function carregarOnboarding(): Promise<void> {
  try {
    const valor = await AsyncStorage.getItem(CHAVE);
    definir({ carregado: true, concluido: valor === '1' });
  } catch {
    // Falha de leitura não pode travar a abertura: seguimos mostrando o
    // onboarding, que é o caminho seguro.
    definir({ carregado: true, concluido: false });
  }
}

/** Marca como concluída e notifica o AuthGate imediatamente. */
export async function concluirOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE, '1');
  } catch {
    // Mesmo sem persistir, seguimos em frente nesta sessão: prender o
    // usuário na apresentação seria pior do que reexibi-la depois.
  }
  definir({ carregado: true, concluido: true });
}

/** Volta a exibir a apresentação — útil para testar o fluxo. */
export async function reiniciarOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  definir({ carregado: true, concluido: false });
}

export function useOnboarding(): EstadoOnboarding {
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
