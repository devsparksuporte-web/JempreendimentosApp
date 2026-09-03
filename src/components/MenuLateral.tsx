import { usePathname, useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { Image, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Navegação lateral para telas largas.
 *
 * Abas na base da tela são padrão de celular. Num monitor de 1440px elas
 * ficam a um palmo do rodapé, com dois terços da largura vazios — e o
 * sistema inteiro passa a impressão de ser um aplicativo esticado.
 *
 * Vale só para a WEB, e não para o tablet: o tablet em pé continua no
 * polegar, e mudar a navegação dele por causa da largura seria trocar um
 * hábito de campo sem ninguém ter pedido.
 */

export type ItemDoMenu = {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
};

/** Onde deixa de fazer sentido empilhar em coluna única. */
const LARGURA_DESKTOP = 900;

/** Diz se a tela comporta o menu lateral. Use nos layouts para esconder as abas. */
export function useMenuLateral(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= LARGURA_DESKTOP;
}

/** Tira os `(grupos)` da rota para poder comparar com o caminho atual. */
function semGrupos(rota: string): string {
  const limpo = rota.replace(/\/\([^)]+\)/g, '');
  return limpo === '' ? '/' : limpo;
}

export function MenuLateral({ itens }: { itens: ItemDoMenu[] }) {
  const router = useRouter();
  const caminho = usePathname();

  return (
    <View style={styles.barra}>
      <View style={styles.marca}>
        <Image
          source={require('@/assets/images/logo-j.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.flex}>
          <Text variant="bodyStrong" color={colors.brandStrong} numberOfLines={1}>
            JEmpreendimentos
          </Text>
          <Text variant="microLabel" color={colors.textMuted}>
            CLIMATIZAÇÃO
          </Text>
        </View>
      </View>

      <View style={styles.lista}>
        {itens.map(({ rota, rotulo, icone: Glifo }) => {
          // `usePathname` devolve o caminho SEM os grupos: a tela
          // `(admin)/estoque` chega como `/estoque`, e a raiz do grupo como
          // `/`. Comparar com a rota crua nunca casaria, e o menu ficaria
          // sem nenhum item marcado.
          const ativo = caminho === semGrupos(rota);
          return (
            <Pressable
              key={rota}
              onPress={() => router.replace(rota as never)}
              accessibilityRole="link"
              accessibilityState={{ selected: ativo }}
              style={({ pressed }) => [
                styles.item,
                ativo && styles.itemAtivo,
                pressed && styles.itemTocado,
              ]}>
              <Glifo size={20} color={ativo ? colors.textOnBrand : colors.textSecondary} />
              <Text
                variant="bodyStrong"
                color={ativo ? colors.textOnBrand : colors.textPrimary}
                numberOfLines={1}>
                {rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="microLabel" color={colors.textMuted} style={styles.rodape}>
        DEVSPARK WEB
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    width: 248,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: spacing.lg,
  },
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  logo: { width: 38, height: 38 },
  flex: { flex: 1 },
  lista: { gap: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  itemAtivo: { backgroundColor: colors.brand },
  itemTocado: { opacity: 0.85 },
  rodape: { marginTop: 'auto', paddingHorizontal: spacing.xs },
});
