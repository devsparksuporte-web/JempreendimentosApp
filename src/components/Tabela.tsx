import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useMenuLateral } from '@/components/MenuLateral';
import { CardGrid } from '@/components/ui/CardGrid';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Lista que vira tabela no navegador em tela larga e continua cartão no resto.
 *
 * A troca usa o mesmo gatilho do menu lateral: só web, só a partir de 900px.
 * No aplicativo nada muda — tabela em tela de celular é rolagem lateral, que
 * é pior que o cartão que já existe. Por isso quem chama entrega os dois
 * desenhos: as `colunas` para a tabela e o `cartao` para o resto.
 *
 * O cartão não é um plano B pior: é o mesmo dado com outra forma. Manter os
 * dois lado a lado no mesmo arquivo é o que impede um de envelhecer sozinho.
 */

export type Coluna<T> = {
  titulo: string;
  /** Largura fixa em px — para colunas curtas: código, data, status. */
  largura?: number;
  /** Proporção da sobra quando não há largura fixa. */
  peso?: number;
  aoDireita?: boolean;
  celula: (item: T) => React.ReactNode;
};

type Props<T> = {
  itens: T[];
  colunas: Coluna<T>[];
  chave: (item: T) => string;
  cartao: (item: T) => React.ReactNode;
  aoAbrir?: (item: T) => void;
  /** Cartões em duas colunas no tablet, como o CardGrid já fazia. */
  emColunas?: boolean;
};

/** RN-web entrega `hovered` no estado do Pressable; a tipagem do RN não. */
function passandoPorCima(estado: unknown): boolean {
  return (estado as { hovered?: boolean }).hovered === true;
}

function larguraDaColuna<T>(c: Coluna<T>): ViewStyle {
  return c.largura ? { width: c.largura, flexGrow: 0, flexShrink: 0 } : { flex: c.peso ?? 1 };
}

export function Tabela<T>({ itens, colunas, chave, cartao, aoAbrir, emColunas }: Props<T>) {
  const comoTabela = useMenuLateral();

  if (!comoTabela) {
    const cartoes = itens.map((item) => <View key={chave(item)}>{cartao(item)}</View>);
    return emColunas ? <CardGrid>{cartoes}</CardGrid> : <View style={styles.pilha}>{cartoes}</View>;
  }

  return (
    <View style={styles.quadro}>
      <View style={styles.cabecalho}>
        {colunas.map((c) => (
          <View key={c.titulo} style={[larguraDaColuna(c), c.aoDireita && styles.direita]}>
            <Text variant="microLabel" color={colors.textSecondary} numberOfLines={1}>
              {c.titulo}
            </Text>
          </View>
        ))}
        {aoAbrir ? <View style={styles.seta} /> : null}
      </View>

      {itens.map((item, i) => (
        <Pressable
          key={chave(item)}
          onPress={aoAbrir ? () => aoAbrir(item) : undefined}
          disabled={!aoAbrir}
          style={(estado) => [
            styles.linha,
            i === itens.length - 1 && styles.ultima,
            passandoPorCima(estado) && styles.linhaSobre,
            estado.pressed && styles.linhaTocada,
          ]}>
          {colunas.map((c) => (
            <View
              key={c.titulo}
              style={[larguraDaColuna(c), styles.celula, c.aoDireita && styles.direita]}>
              {c.celula(item)}
            </View>
          ))}
          {aoAbrir ? (
            <View style={[styles.seta, styles.celula]}>
              <ChevronRight size={16} color={colors.slate300} />
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pilha: { gap: spacing.md },

  quadro: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgApp,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ultima: { borderBottomWidth: 0 },
  linhaSobre: { backgroundColor: colors.brandTint },
  linhaTocada: { opacity: 0.85 },
  celula: { justifyContent: 'center' },
  direita: { alignItems: 'flex-end' },
  seta: { width: 20, alignItems: 'flex-end' },
});
