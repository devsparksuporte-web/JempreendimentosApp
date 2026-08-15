import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TriagemChat } from '@/components/triagem/TriagemChat';
import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/ui/Header';
import { colors } from '@/theme/tokens';

/** Abertura de chamado via triagem da IA. Fluxo modal — sem tab bar. */
export default function NovoChamadoScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Header
        title="Abrir chamado"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(cliente)'))}
        trailing={<Badge label="IA" tone="ai" />}
      />
      <TriagemChat />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
});
