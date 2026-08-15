import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing, touch } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Ocupa a largura toda — padrão nas ações principais. */
  block?: boolean;
};

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.textOnBrand, border: colors.brand },
  secondary: { bg: colors.bgSurface, fg: colors.textPrimary, border: colors.border },
  success: { bg: colors.success, fg: colors.textOnBrand, border: colors.success },
  danger: { bg: colors.danger, fg: colors.textOnBrand, border: colors.danger },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  loading = false,
  disabled = false,
  block = true,
}: ButtonProps) {
  const v = variants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        block && styles.block,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {Icon ? <Icon size={20} color={v.fg} strokeWidth={2.5} /> : null}
          <Text variant="microLabel" color={v.fg}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // Altura generosa: o técnico usa em campo, às vezes com luva.
    minHeight: touch.primaryButton,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  block: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  inactive: { opacity: 0.5 },
});
