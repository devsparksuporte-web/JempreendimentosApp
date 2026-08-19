import { useSyncExternalStore } from 'react';

import { contarNaoLidas } from '@/services/notifications';

/**
 * Contador de não lidas do sino.
 *
 * Compartilhado porque o número aparece em vários cabeçalhos ao mesmo tempo e
 * muda por três caminhos diferentes: chegada em tempo real, leitura de uma
 * notificação e "marcar todas". Cada tela consultando o banco por conta
 * própria deixaria os sinos divergentes na mesma sessão.
 */

let contagem = 0;
const ouvintes = new Set<() => void>();

function definir(valor: number) {
  const novo = Math.max(0, valor);
  if (novo === contagem) return;
  contagem = novo;
  ouvintes.forEach((avisar) => avisar());
}

/** Relê do banco. Chamado na abertura e ao voltar para a central. */
export async function recarregarNaoLidas(): Promise<void> {
  try {
    definir(await contarNaoLidas());
  } catch {
    // Sem contador o app segue funcionando; insistir aqui não ajuda ninguém.
  }
}

/** Chegou uma nova pelo Realtime. */
export function incrementarNaoLidas() {
  definir(contagem + 1);
}

/** Uma foi lida. */
export function decrementarNaoLidas() {
  definir(contagem - 1);
}

export function zerarNaoLidas() {
  definir(0);
}

export function useNaoLidas(): number {
  return useSyncExternalStore(
    (aoMudar) => {
      ouvintes.add(aoMudar);
      return () => {
        ouvintes.delete(aoMudar);
      };
    },
    () => contagem,
    () => contagem,
  );
}
