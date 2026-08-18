import { useRouter } from 'expo-router';
import { ClipboardList, QrCode, RefreshCw, Route } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { fetchTechnicianCalls, type TechnicianCall } from '@/services/technician';

export default function TechnicianHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [calls, setCalls] = useState<TechnicianCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setCalls(await fetchTechnicianCalls()); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar os chamados.'); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return <View style={styles.root}>
    <Header title="Atendimentos" eyebrow="JEmpreendimentos · Técnico" trailing={<Pressable onPress={load} style={styles.refresh}><RefreshCw size={18} color={colors.brand} /></Pressable>} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}>
      <View style={styles.container}>
        <View style={styles.intro}><Text variant="screenTitle">Atendimentos de hoje</Text><Text variant="body" color={colors.textSecondary}>Abra o chamado, confira o equipamento e registre cada evidência.</Text></View>
        <View style={styles.quickActions}><Pressable onPress={() => router.push('/(tecnico)/qr')} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><QrCode size={22} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong" color={colors.brandStrong}>Ler QR Code</Text><Text variant="body" color={colors.textSecondary}>Abrir equipamento</Text></View></Pressable><Pressable onPress={() => router.push('/(tecnico)/rota' as never)} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><Route size={22} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong" color={colors.brandStrong}>Minha rota</Text><Text variant="body" color={colors.textSecondary}>Mapa e visitas</Text></View></Pressable></View>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : calls.length === 0 ? <Card><View style={styles.empty}><ClipboardList size={28} color={colors.textMuted} /><Text variant="bodyStrong">Nenhum chamado atribuído</Text><Text variant="body" color={colors.textSecondary}>Quando a equipe atribuir um atendimento, ele aparecerá aqui.</Text></View></Card> : calls.map((call) => <Card key={call.id} onPress={() => router.push(`/(tecnico)/chamado/${call.id}`)} padded="md"><View style={styles.call}><View style={styles.flex}><View style={styles.rowBetween}><Text variant="cardTitle">#{call.code} · {call.client?.name ?? 'Cliente'}</Text><Badge label={call.priority} tone={call.priority === 'urgente' ? 'danger' : 'info'} /></View><Text variant="body">{call.title}</Text><Text variant="meta" color={colors.textSecondary}>{call.equipment?.brand ?? 'Equipamento'} {call.equipment?.model ?? ''} · {call.equipment?.environment ?? 'Ambiente não informado'}</Text></View></View></Card>)}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl, gap: spacing.lg },
  intro: { gap: spacing.xs },
  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: { flex: 1, minHeight: 92, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandSoft, borderRadius: radius.xl, padding: spacing.md },
  call: { flexDirection: 'row', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  refresh: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
