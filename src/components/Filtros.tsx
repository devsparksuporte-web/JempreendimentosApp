import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/**
 * Faixa de filtros das telas de lista: pílulas de recorte e campo de texto.
 *
 * A mesma pílula estava copiada em sete telas, cada uma com seu estilo local.
 * Copiada é copiada: quando o desenho muda, seis ficam para trás.
 *
 * O campo de texto é opcional e filtra o que já está em memória — não
 * consulta o banco. Serve para achar dentro do que a tela carregou; a busca
 * que vai ao banco é a do cabeçalho, e são coisas diferentes de propósito.
 */

export type Opcao<K extends string> = { chave: K; rotulo: string };

type Props<K extends string> = {
  /** Vazio quando a tela só precisa do campo de texto. */
  opcoes?: Opcao<K>[];
  valor?: K;
  aoTrocar?: (chave: K) => void;
  busca?: { valor: string; aoDigitar: (texto: string) => void; dica: string };
};

export function Filtros<K extends string>({ opcoes = [], valor, aoTrocar, busca }: Props<K>) {
  return (
    <View style={styles.faixa}>
      <View style={styles.pilulas}>
        {opcoes.map(({ chave, rotulo }) => {
          const ativo = chave === valor;
          return (
            <Pressable
              key={chave}
              onPress={() => aoTrocar?.(chave)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              style={({ pressed }) => [
                styles.pilula,
                ativo ? styles.ativa : styles.inativa,
                pressed && styles.tocada,
              ]}>
              <Text variant="meta" color={ativo ? colors.textOnBrand : colors.textSecondary}>
                {rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {busca ? (
        <View style={styles.campo}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            value={busca.valor}
            onChangeText={busca.aoDigitar}
            placeholder={busca.dica}
            placeholderTextColor={colors.textMuted}
            style={styles.entrada}
            returnKeyType="search"
          />
          {busca.valor ? (
            <Pressable onPress={() => busca.aoDigitar('')} hitSlop={8} accessibilityLabel="Limpar">
              <X size={15} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Deixa o texto comparável: sem acento, sem caixa, sem sobra nas pontas. */
export function comparavel(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const styles = StyleSheet.create({
  faixa: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pilula: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  ativa: { backgroundColor: colors.brand, borderColor: colors.brand },
  inativa: { backgroundColor: colors.bgSurface, borderColor: colors.border },
  tocada: { opacity: 0.85 },

  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 220,
    maxWidth: 340,
    marginLeft: 'auto',
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  entrada: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    outlineStyle: 'none' as never,
  },
});
