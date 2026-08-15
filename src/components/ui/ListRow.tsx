import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme/tokens';

type ListRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  iconColor?: string;
  iconBackground?: string;
  /** Conteúdo à direita (ex.: um Badge). Substitui o chevron quando presente. */
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListRow({
  icon,
  title,
  subtitle,
  iconColor,
  iconBackground,
  trailing,
  onPress,
}: ListRowProps) {
  return (
    <Card onPress={onPress} padded="md">
      <View style={styles.row}>
        <IconTile icon={icon} size="md" color={iconColor} background={iconBackground} />
        <View style={styles.texts}>
          <Text variant="cardTitle" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ?? <ChevronRight size={20} color={colors.slate300} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  texts: { flex: 1, gap: 2 },
});
