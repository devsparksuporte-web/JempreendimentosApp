import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Warehouse } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { fetchInventory, type InventoryRow } from '@/services/operations';

export default function AdminInventoryScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { setRows(await fetchInventory()); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o estoque.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const low = rows.filter((row) => Number(row.quantity) <= Number(row.min_quantity));
  return <View style={styles.root}><Header title="Controle de estoque" eyebrow="Operação · Peças" trailing={<Pressable onPress={load} style={styles.refresh}><RefreshCw size={18} color={colors.brand} /></Pressable>} /><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}><View style={styles.container}><View style={styles.summary}><Warehouse size={22} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Estoque operacional</Text><Text variant="body" color={colors.textSecondary}>{low.length} peça(s) abaixo do mínimo</Text></View><Badge label={`${rows.length} itens`} tone={low.length ? 'warning' : 'success'} /></View>{loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : rows.map((row) => { const isLow = Number(row.quantity) <= Number(row.min_quantity); return <Card key={row.part_id} padded="md" style={isLow ? styles.lowCard : undefined}><View style={styles.row}><View style={styles.flex}><Text variant="bodyStrong">{row.part?.name ?? 'Peça sem nome'}</Text><Text variant="meta" color={colors.textSecondary}>{row.location ?? 'Local não informado'}</Text></View><View style={styles.quantity}><Text variant="kpi" color={isLow ? colors.warningStrong : colors.brandStrong}>{String(row.quantity)}</Text><Text variant="meta" color={colors.textSecondary}>mín. {String(row.min_quantity)}</Text></View></View>{isLow ? <Badge label="Repor / cotar" tone="warning" /> : null}</Card>; })}</View></ScrollView></View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bgApp }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, padding: layout.screenPadding, gap: spacing.md }, summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandSoft, borderRadius: radius.xl, padding: spacing.lg }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, flex: { flex: 1, gap: spacing.xs }, quantity: { alignItems: 'flex-end', gap: 2 }, lowCard: { borderColor: colors.warning, backgroundColor: '#fffaf0' }, refresh: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border } });
