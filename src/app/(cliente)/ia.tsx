import { StyleSheet, View } from 'react-native';

import { TriagemChat } from '@/components/triagem/TriagemChat';
import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/ui/Header';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme/tokens';

/** Aba IA: mesma triagem da abertura de chamado, dentro da tab bar. */
export default function IaScreen() {
  return (
    <View style={styles.root}>
      <Header
        title="Assistente"
        subtitle={
          <View style={styles.online}>
            <View style={styles.onlineDot} />
            <Text variant="microLabel" color={colors.textSecondary}>
              IA online
            </Text>
          </View>
        }
        trailing={<Badge label="IA" tone="ai" />}
      />
      {/* Compensa a altura da tab bar para o campo de mensagem não ficar coberto. */}
      <TriagemChat bottomInset={76} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  online: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
});
