import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, elevation, radius, spacing } from '@/theme/tokens';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  padded?: 'lg' | 'md';
  /** Cor de borda de destaque (ex.: azul para o card de atendimento ativo). */
  accentBorder?: string;
  style?: ViewStyle;
};

export function Card({ children, onPress, padded = 'lg', accentBorder, style }: CardProps) {
  const content = [
    styles.base,
    padded === 'lg' ? styles.padLg : styles.padMd,
    accentBorder ? { borderColor: accentBorder } : null,
    style,
  ];

  if (!onPress) {
    return <View style={content}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...content, pressed && styles.pressed]}
      accessibilityRole="button">
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    ...elevation.card,
  },
  padLg: { padding: spacing.xl },
  padMd: { padding: spacing.lg },
  // Feedback de toque discreto e funcional (design system, seção Movimento).
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});
