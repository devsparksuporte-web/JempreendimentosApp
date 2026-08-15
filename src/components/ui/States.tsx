import { AlertTriangle, type LucideIcon, WifiOff } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

/** Estados obrigatórios de toda lista/tela (design system, seção Componentes). */

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
      <Text variant="meta" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Icon size={40} color={colors.slate300} strokeWidth={1.75} />
      <Text variant="cardTitle" color={colors.textSecondary}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color={colors.textMuted} style={styles.centered}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" block={false} />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.center, styles.errorBox]}>
      <AlertTriangle size={32} color={colors.danger} />
      <Text variant="cardTitle" color={colors.dangerStrong}>
        Não foi possível carregar
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.centered}>
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button label="Tentar novamente" onPress={onRetry} variant="secondary" block={false} />
        </View>
      ) : null}
    </View>
  );
}

/** Faixa de offline — os dados serão sincronizados quando a conexão voltar. */
export function OfflineBanner() {
  return (
    <View style={styles.offline}>
      <WifiOff size={18} color={colors.warningStrong} />
      <Text variant="meta" color={colors.warningStrong} style={styles.flex}>
        Sem conexão — as alterações serão sincronizadas automaticamente
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  centered: { textAlign: 'center' },
  action: { marginTop: spacing.xs },
  flex: { flex: 1 },
  errorBox: {
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningSoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
