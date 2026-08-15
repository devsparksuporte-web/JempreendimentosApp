import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

export type BadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'ai';

const tones: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  info: { bg: colors.infoSoft, fg: colors.infoStrong, border: colors.brandSoft },
  success: { bg: colors.successSoft, fg: colors.successStrong, border: colors.successSoft },
  warning: { bg: colors.warningSoft, fg: colors.warningStrong, border: colors.warningSoft },
  danger: { bg: colors.dangerSoft, fg: colors.dangerStrong, border: colors.dangerSoft },
  neutral: { bg: colors.slate100, fg: colors.textSecondary, border: colors.border },
  ai: { bg: colors.aiSoft, fg: colors.aiStrong, border: colors.aiBorder },
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  /** Ponto pulsante — usar só em estado ao vivo (ex.: A CAMINHO). */
  live?: boolean;
};

export function Badge({ label, tone = 'info', live = false }: BadgeProps) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      {live ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      <Text variant="meta" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
