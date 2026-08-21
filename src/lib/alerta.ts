import { Alert as AlertNativo, Platform, type AlertButton } from 'react-native';

/**
 * Alert que também funciona no navegador.
 *
 * O `Alert` do react-native-web é `static alert() {}` — um método vazio. Na
 * web isso fazia toda confirmação e todo aviso de erro do app sumirem em
 * silêncio: o botão de sair não saía, o de cancelar pedido não cancelava, e
 * quando alguma coisa falhava a pessoa não via nada acontecer.
 *
 * A assinatura é a mesma do nativo, então nenhum ponto de chamada muda de
 * forma. No navegador, um botão vira `window.alert`; dois ou mais viram
 * `window.confirm`, com o botão `cancel` na recusa e a última ação na
 * aceitação — que é onde ficam, pela convenção deste app, o Salvar e o
 * Apagar.
 *
 * Não é bonito como um modal desenhado, mas é honesto: a pessoa vê a
 * pergunta e a resposta dela vale. Um modal próprio pode vir depois sem
 * mexer em nenhum dos pontos de chamada.
 */
function alert(titulo: string, mensagem?: string, botoes?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    AlertNativo.alert(titulo, mensagem, botoes);
    return;
  }

  const texto = mensagem ? `${titulo}\n\n${mensagem}` : titulo;

  if (!botoes || botoes.length === 0) {
    window.alert(texto);
    return;
  }

  if (botoes.length === 1) {
    window.alert(texto);
    botoes[0].onPress?.();
    return;
  }

  const cancelar = botoes.find((b) => b.style === 'cancel');
  const confirmar =
    [...botoes].reverse().find((b) => b.style !== 'cancel') ?? botoes[botoes.length - 1];

  if (window.confirm(texto)) confirmar.onPress?.();
  else cancelar?.onPress?.();
}

export const Alert = { alert };
