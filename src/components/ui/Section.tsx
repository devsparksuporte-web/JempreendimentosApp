import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme/tokens';

type SectionProps = {
  label: string;
  children: ReactNode;
  /** Cor do micro-label — violeta quando a seção é conteúdo de IA. */
  labelColor?: string;
};

export function Section({ label, children, labelColor = colors.textSecondary }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text variant="microLabel" color={labelColor}>
        {label}
      </Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  content: { gap: spacing.md },
});
