import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';

import { colors, type } from '@/theme/tokens';

type Variant = keyof typeof type;

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: string;
};

/**
 * Único ponto de saída de texto do app — garante que toda tela use
 * Plus Jakarta Sans e a escala tipográfica do design system.
 */
export function Text({ variant = 'body', color = colors.textPrimary, style, ...rest }: TextProps) {
  return <RNText style={[styles[variant], { color }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  kpi: type.kpi,
  screenTitle: type.screenTitle,
  cardTitle: type.cardTitle,
  body: type.body,
  bodyStrong: type.bodyStrong,
  microLabel: type.microLabel,
  meta: type.meta,
  tabLabel: type.tabLabel,
});
