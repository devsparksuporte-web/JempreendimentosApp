import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { fetchPmoc, type PmocRow } from '@/services/operations';

export default function AdminPmocScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<PmocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { setRows(await fetchPmoc()); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o PMOC.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <View style={styles.root}><Header title="PMOC" eyebrow="Operação · Conformidade" trailing={<Pressable onPress={load} style={styles.refresh}><RefreshCw size={18} color={colors.brand} /></Pressable>} /><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}><View style={styles.container}><View style={styles.summary}><CalendarClock size={22} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Planos ativos</Text><Text variant="body" color={colors.textSecondary}>Rotinas de limpeza, teste e inspeção</Text></View><Badge label={`${rows.length}`} tone="info" /></View>{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : rows.length === 0 ? <Card><Text variant="body" color={colors.textSecondary}>Nenhum PMOC ativo cadastrado.</Text></Card> : rows.map((pmoc) => <Card key={pmoc.id} onPress={() => router.push(`/(admin)/pmoc/${pmoc.id}` as never)}><Text variant="microLabel" color={colors.textSecondary}>{pmoc.client?.name ?? 'Cliente'}</Text><Text variant="screenTitle">{pmoc.title}</Text><Text variant="meta" color={colors.textSecondary}>Início {pmoc.start_date}{pmoc.end_date ? ` · fim ${pmoc.end_date}` : ''}</Text><View style={styles.items}>{pmoc.items.map((item) => <View key={item.id} style={styles.item}><View style={styles.flex}><Text variant="bodyStrong">{item.routine}</Text><Text variant="meta" color={colors.textSecondary}>{item.equipment?.brand ?? 'Equipamento'} {item.equipment?.model ?? ''} · {item.equipment?.environment ?? 'Ambiente'}</Text></View><Badge label={item.next_execution ?? 'Sem data'} tone={item.next_execution && item.next_execution <= new Date().toISOString().slice(0, 10) ? 'danger' : 'neutral'} /></View>)}</View></Card>)}</View></ScrollView></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bgApp }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, padding: layout.screenPadding, gap: spacing.md }, summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandSoft, borderRadius: radius.xl, padding: spacing.lg }, items: { marginTop: spacing.lg, gap: spacing.sm }, item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, flex: { flex: 1, gap: spacing.xs }, refresh: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border } });
