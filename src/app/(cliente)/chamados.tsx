import { useRouter } from 'expo-router';
import { ClipboardList, Plus, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  equipmentName,
  formatDate,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_LIVE,
  STATUS_TONE,
} from '@/lib/format';
import { fetchMyServiceCalls, type ServiceCallDetailed } from '@/services/client';
import { colors, layout, spacing } from '@/theme/tokens';

export default function ChamadosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [calls, setCalls] = useState<ServiceCallDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCalls(await fetchMyServiceCalls());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar chamados.');
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
      <Header title="Chamados" />
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
          ) : calls.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhum chamado ainda"
              description="Quando precisar de atendimento, abra um chamado e acompanhe tudo por aqui."
              actionLabel="Abrir chamado"
              onAction={() => router.push('/chamado/novo')}
            />
          ) : (
            <>
              <Button label="Abrir chamado" icon={Plus} onPress={() => router.push('/chamado/novo')} />

              {calls.map((c) => (
                <Card key={c.id} onPress={() => router.push(`/chamado/${c.id}`)} padded="md">
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <IconTile icon={Wrench} size="md" />
                      <View style={styles.flex}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {c.title}
                        </Text>
                        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                          #{c.code} · {c.equipment ? equipmentName(c.equipment) : 'Sem equipamento'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.badges}>
                      <Badge
                        label={STATUS_LABEL[c.status]}
                        tone={STATUS_TONE[c.status]}
                        live={STATUS_LIVE.includes(c.status)}
                      />
                      <Badge label={PRIORITY_LABEL[c.priority]} tone={PRIORITY_TONE[c.priority]} />
                      <Text variant="meta" color={colors.textMuted}>
                        {formatDate(c.created_at)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
        </View>
      </ScrollView>
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
    gap: spacing.md,
  },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
