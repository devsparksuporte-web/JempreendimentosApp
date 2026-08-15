import { AirVent, Snowflake } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { equipmentName, formatDate } from '@/lib/format';
import { fetchClienteHome } from '@/services/client';
import { colors, layout, spacing } from '@/theme/tokens';
import type { Equipment } from '@/types/database';

export default function EquipamentosScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchClienteHome();
      setItems(data.equipment);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar equipamentos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <Header title="Equipamentos" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={[styles.container, { paddingBottom: spacing.xxl + insets.bottom }]}>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={AirVent}
              title="Nenhum equipamento cadastrado"
              description="Assim que a equipe cadastrar seus aparelhos, eles aparecem aqui com todo o histórico."
            />
          ) : (
            items.map((e) => (
              <Card key={e.id}>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <IconTile icon={AirVent} />
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{equipmentName(e)}</Text>
                      <Text variant="meta" color={colors.textSecondary}>
                        {e.environment ?? 'Ambiente não informado'}
                      </Text>
                    </View>
                    <Badge label="Em dia" tone="success" />
                  </View>

                  <View style={styles.specs}>
                    <Spec rotulo="Modelo" valor={e.model ?? '—'} />
                    <Spec rotulo="Nº de série" valor={e.serial_number ?? '—'} />
                    <Spec rotulo="Gás" valor={e.gas_type ?? '—'} />
                    <Spec rotulo="Tecnologia" valor={e.technology ?? '—'} />
                    <Spec rotulo="Instalado em" valor={formatDate(e.installed_at)} />
                    <Spec rotulo="Garantia até" valor={formatDate(e.warranty_until)} />
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Spec({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.spec}>
      <View style={styles.specIcon}>
        <Snowflake size={12} color={colors.textMuted} />
      </View>
      <Text variant="meta" color={colors.textSecondary} style={styles.flex}>
        {rotulo}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  specs: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  spec: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  specIcon: { width: 16, alignItems: 'center' },
});
