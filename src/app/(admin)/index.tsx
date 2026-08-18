import { useRouter } from 'expo-router';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, FileCheck2, HardHat, PackageSearch, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CardGrid } from '@/components/ui/CardGrid';
import { Header } from '@/components/ui/Header';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { fetchAdminDashboard, technicianStatusLabel, type AdminDashboard } from '@/services/admin';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export default function AdminHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchAdminDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o painel.');
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
      <Header title="Painel operacional" eyebrow="JEmpreendimentos · Admin" trailing={<Pressable onPress={load} style={styles.refresh}><RefreshCw size={18} color={colors.brand} /></Pressable>} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
        <View style={styles.container}>
          <View style={styles.intro}>
            <Text variant="screenTitle">Visão geral da operação</Text>
            <Text variant="body" color={colors.textSecondary}>Acompanhe chamados, equipe e preventivas em um só lugar.</Text>
          </View>

          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : data ? (
            <>
              <View style={styles.metrics}>
                <Metric icon={ClipboardList} label="Chamados abertos" value={String(data.totals.open)} tone="brand" />
                <Metric icon={AlertCircle} label="Urgentes" value={String(data.totals.urgent)} tone="danger" />
                <Metric icon={HardHat} label="Técnicos livres" value={String(data.totals.techniciansAvailable)} tone="success" />
              </View>

              <Card style={styles.maintenanceCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <View style={styles.iconCircle}><CalendarClock size={20} color={colors.brandStrong} /></View>
                    <View><Text variant="microLabel" color={colors.textSecondary}>Próximos 7 dias</Text><Text variant="cardTitle">Manutenções preventivas</Text></View>
                  </View>
                  <Text variant="kpi" color={colors.brand}>{String(data.maintenanceDue)}</Text>
                </View>
              </Card>

              <View style={styles.operationLinks}>
                <Pressable onPress={() => router.push('/(admin)/pmoc' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><FileCheck2 size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">PMOC e conformidade</Text><Text variant="meta" color={colors.textSecondary}>Rotinas e próximas execuções</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/estoque' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><PackageSearch size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Controle de estoque</Text><Text variant="meta" color={colors.textSecondary}>Saldo mínimo e reposição</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
              </View>

              <View style={styles.sectionHeader}><Text variant="microLabel" color={colors.textSecondary}>Fila de atendimento</Text><Badge label={`${data.calls.length} ativos`} tone={data.calls.length ? 'info' : 'success'} /></View>
              {data.calls.length === 0 ? (
                <Card><View style={styles.empty}><CheckCircle2 size={28} color={colors.success} /><Text variant="bodyStrong">Nenhum chamado pendente</Text><Text variant="body" color={colors.textSecondary}>A operação está em dia.</Text></View></Card>
              ) : (
              <CardGrid>
              {data.calls.slice(0, 12).map((call) => (
                <Card key={call.id} onPress={() => router.push(`/(admin)/chamado/${call.id}` as never)} padded="md">
                  <View style={styles.callRow}>
                    <View style={styles.callMain}>
                      <View style={styles.rowBetween}><Text variant="cardTitle">#{call.code} · {call.client?.name ?? 'Cliente'}</Text><Badge label={call.priority} tone={call.priority === 'urgente' ? 'danger' : 'neutral'} /></View>
                      <Text variant="body" numberOfLines={1}>{call.title}</Text>
                      <Text variant="meta" color={colors.textSecondary}>{call.technician?.profile?.full_name ?? 'Sem técnico atribuído'}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.slate300} />
                  </View>
                </Card>
              ))}
              </CardGrid>
              )}

              <View style={styles.sectionHeader}><Text variant="microLabel" color={colors.textSecondary}>Equipe técnica</Text><Badge label={`${data.technicians.length} ativos`} tone="neutral" /></View>
              <CardGrid>
              {data.technicians.map((technician) => (
                <Card key={technician.id} padded="md">
                  <View style={styles.rowBetween}><View style={styles.row}><View style={styles.iconCircle}><HardHat size={18} color={colors.brandStrong} /></View><View><Text variant="bodyStrong">{technician.profile?.full_name ?? 'Técnico sem nome'}</Text><Text variant="meta" color={colors.textSecondary}>{technicianStatusLabel(technician.status)}</Text></View></View><Badge label={technician.status === 'disponivel' ? 'Livre' : 'Ocupado'} tone={technician.status === 'disponivel' ? 'success' : 'neutral'} /></View>
                </Card>
              ))}
              </CardGrid>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof ClipboardList; label: string; value: string; tone: 'brand' | 'danger' | 'success' }) {
  const palette = { brand: [colors.brandTint, colors.brandStrong], danger: [colors.dangerSoft, colors.dangerStrong], success: [colors.successSoft, colors.successStrong] }[tone];
  return <Card padded="md" style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: palette[0] }]}><Icon size={18} color={palette[1]} /></View><Text variant="kpi" color={palette[1]}>{value}</Text><Text variant="meta" color={colors.textSecondary}>{label}</Text></Card>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl, gap: spacing.lg },
  intro: { gap: spacing.xs },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  metricIcon: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  maintenanceCard: { backgroundColor: colors.brandTint, borderColor: colors.brandSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  iconCircle: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  callRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  callMain: { flex: 1, gap: spacing.xs },
  flex: { flex: 1, gap: spacing.xs },
  operationLinks: { gap: spacing.sm },
  operationLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  refresh: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
