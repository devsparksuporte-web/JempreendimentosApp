import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, layout, radius, spacing, touch } from '@/theme/tokens';

type HeaderProps = {
  title: string;
  /** Assinatura da marca — só na tela raiz de cada perfil. */
  eyebrow?: string;
  /** Conteudo livre abaixo do titulo. Tem precedencia sobre `eyebrow`. */
  subtitle?: ReactNode;
  onBack?: () => void;
  trailing?: ReactNode;
};

/** Header fixo branco com borda inferior, respeitando a safe area. */
export function Header({ title, eyebrow, subtitle, onBack, trailing }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.inner}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <ChevronLeft size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null}

        <View style={styles.brandMark}><Text variant="screenTitle" color={colors.textOnBrand}>J</Text></View>
        <View style={styles.titles}>
          <Text variant="screenTitle" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ??
            (eyebrow ? (
              <Text variant="meta" color={colors.brand}>
                {eyebrow}
              </Text>
            ) : null)}
        </View>

        {trailing ?? <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brandTint,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
  iconButton: {
    width: touch.minTarget - 8,
    height: touch.minTarget - 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 0 },
  pressed: { transform: [{ scale: 0.95 }] },
});
