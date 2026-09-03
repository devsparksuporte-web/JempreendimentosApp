import { ActivityIndicator, Image, StyleSheet, Text as TextoNativo, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, spacing } from '@/theme/tokens';

/**
 * O que aparece enquanto o aplicativo carrega.
 *
 * Antes eram três barras azuis sobre fundo escuro — abstrato e sem relação
 * com o que a empresa faz. Agora é o logo com um split desenhado e o ar
 * saindo dele: em dois segundos de espera, quem abre já sabe do que se trata.
 *
 * Fundo claro de propósito, igual ao do login: a abertura escura entrando
 * numa tela clara piscava na cara de quem entrava.
 *
 * O desenho é vetor e não imagem. Numa tela que aparece antes de tudo, uma
 * imagem grande atrasaria justamente o momento que ela deveria disfarçar.
 */
export function Abertura() {
  return (
    <View style={styles.raiz}>
      <Image
        source={require('@/assets/images/logo-j.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <SplitComVento />

      <TextoNativo style={styles.titulo}>JEMPREENDIMENTOS</TextoNativo>
      <TextoNativo style={styles.subtitulo}>CLIMATIZAÇÃO E SERVIÇOS</TextoNativo>

      <ActivityIndicator size="small" color={colors.brand} style={styles.girando} />
    </View>
  );
}

/** Evaporadora de parede e três correntes de ar saindo pela frente. */
export function SplitComVento({ largura = 132 }: { largura?: number }) {
  return (
    <Svg
      width={largura}
      height={(largura * 66) / 132}
      viewBox="0 0 132 66"
      accessibilityLabel="Ar-condicionado split">
      {/* Corpo da evaporadora */}
      <Rect
        x={8}
        y={6}
        width={116}
        height={26}
        rx={9}
        fill={colors.bgSurface}
        stroke={colors.brand}
        strokeWidth={2.4}
      />
      {/* Aleta de saída */}
      <Path
        d="M18 26 H114"
        stroke={colors.brandSoft}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Correntes de ar, cada uma um pouco menor que a anterior */}
      <Path
        d="M30 42 q14 10 28 0 q14 -10 28 0"
        stroke={colors.brand}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M38 52 q12 9 24 0 q12 -9 24 0"
        stroke={colors.brand}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      <Path
        d="M48 61 q10 7 20 0"
        stroke={colors.brand}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.3}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgApp,
    paddingHorizontal: spacing.lg,
  },
  logo: { width: 108, height: 108, marginBottom: spacing.sm },
  titulo: {
    marginTop: spacing.lg,
    color: colors.brandStrong,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  subtitulo: {
    marginTop: 7,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.1,
  },
  girando: { marginTop: spacing.xl },
});
