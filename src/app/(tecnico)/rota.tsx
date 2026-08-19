import { useRouter } from 'expo-router';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Info, MapPin, MessageCircle, Navigation, Phone, RefreshCw, Route, ShieldCheck, Wind } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { MapboxRouteMap } from '@/components/MapboxRouteMap';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatarDistancia, formatarDuracao, type Trajeto } from '@/services/navegacao';
import { fetchTechnicianCalls, type TechnicianCall } from '@/services/technician';
import { colors, elevation, fonts, layout, radius, spacing } from '@/theme/tokens';

export default function TechnicianRouteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [calls, setCalls] = useState<TechnicianCall[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trajeto, setTrajeto] = useState<Trajeto | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchTechnicianCalls();
      setCalls(next);
      setSelectedId((current) => current && next.some((call) => call.id === current) ? current : next[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a rota.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const scrollRef = useRef<ScrollView>(null);
  const selected = useMemo(() => calls.find((call) => call.id === selectedId) ?? calls[0] ?? null, [calls, selectedId]);
  const orderedCalls = useMemo(() => [...calls].sort((a, b) => (a.scheduled_for ?? '9999').localeCompare(b.scheduled_for ?? '9999')), [calls]);

  /**
   * Centraliza a parada no mapa embutido, em vez de jogar o tecnico para fora
   * do app. A navegacao turn-by-turn continua disponivel dentro do mapa.
   */
  function verNoMapa(call: TechnicianCall) {
    setSelectedId(call.id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  return <View style={styles.root}>
    <View style={styles.mapArea}>
      <MapboxRouteMap calls={calls} selectedId={selected?.id ?? null} onSelect={setSelectedId} onTrajeto={setTrajeto} />
      <View style={styles.topBar}><Pressable onPress={() => router.back()} style={styles.iconButton}><ArrowLeft size={20} color={colors.textPrimary} /></Pressable><View style={styles.live}><View style={styles.liveDot} /><Text variant="meta" color={colors.textPrimary}>Mapbox em tempo real</Text></View></View>

      {/* Cartao de deslocamento: aparece so quando ha rota tracada, para nao
          tapar o mapa com numeros vazios. */}
      {trajeto ? (
        <View style={styles.eta}>
          <View style={styles.etaLinha}>
            <View style={styles.etaBloco}>
              <View style={styles.etaSelo}>
                <Text variant="meta" color={colors.brandSoft}>ETA</Text>
                <Text variant="bodyStrong" color={colors.brand}>{formatarDuracao(trajeto.duracao)}</Text>
              </View>
              <View>
                <Text variant="meta" color={colors.textMuted}>Distância</Text>
                <Text variant="bodyStrong">{formatarDistancia(trajeto.distancia)}</Text>
              </View>
            </View>

            <View style={styles.etaDivisor} />

            <View style={styles.etaStatus}>
              <Text variant="meta" color={colors.textMuted}>Status</Text>
              <View style={styles.etaStatusLinha}>
                <CheckCircle2 size={15} color={colors.success} />
                <Text variant="bodyStrong" color={colors.successStrong}>No fluxo</Text>
              </View>
            </View>
          </View>

          <View style={styles.etaRodape}>
            <Info size={14} color={colors.brand} />
            <Text variant="meta" color={colors.textSecondary}>Rota recalculada pelo Mapbox</Text>
          </View>
        </View>
      ) : null}
    </View>
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false} refreshControl={undefined}>
      <View style={styles.panel}>
        <View style={styles.panelHandle} />
        <View style={styles.panelHeader}><View><Text variant="microLabel" color={colors.textSecondary}>Rota de hoje</Text><Text variant="screenTitle">Visitas programadas</Text></View><Pressable onPress={() => { setRefreshing(true); load(); }} style={styles.refresh}><RefreshCw size={18} color={colors.brand} /></Pressable></View>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : calls.length === 0 ? <Card><View style={styles.empty}><CalendarDays size={26} color={colors.textMuted} /><Text variant="bodyStrong">Nenhum atendimento na rota</Text><Text variant="body" color={colors.textSecondary}>Chamados atribuídos aparecerão aqui com o endereço real.</Text></View></Card> : <>
          <View style={styles.stats}><Route size={18} color={colors.brand} /><Text variant="bodyStrong">{calls.length} atendimento(s)</Text><Text variant="body" color={colors.textSecondary}>Distância e tempo serão calculados ao abrir o mapa.</Text></View>
          {orderedCalls.map((call, index) => <Pressable key={call.id} onPress={() => setSelectedId(call.id)} style={({ pressed }) => [styles.stop, selected?.id === call.id && styles.stopSelected, pressed && styles.pressed]}><View style={styles.stopRail}><View style={[styles.stopDot, selected?.id === call.id && styles.stopDotSelected]} /><View style={styles.stopConnector} /></View><View style={styles.stopContent}><View style={styles.rowBetween}><Text variant="microLabel" color={colors.textSecondary}>{call.scheduled_for ? new Date(call.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Sem horário'}</Text><Badge label={call.priority} tone={call.priority === 'urgente' ? 'danger' : 'info'} /></View><Text variant="cardTitle">#{call.code} · {call.client?.name ?? 'Cliente'}</Text><Text variant="body" numberOfLines={1}>{call.title}</Text><View style={styles.metaRow}><MapPin size={14} color={colors.warning} /><Text variant="meta" color={colors.textSecondary} numberOfLines={1}>{call.address ? `${call.address.street}, ${call.address.number ?? 's/n'} — ${call.address.city}` : 'Endereço não informado'}</Text></View><View style={styles.metaRow}><Wind size={14} color={colors.brand} /><Text variant="meta" color={colors.textSecondary} numberOfLines={1}>{call.equipment?.brand ?? 'Equipamento'} {call.equipment?.model ?? ''}</Text></View><View style={styles.stopActions}><Pressable onPress={() => router.push(`/(tecnico)/chamado/${call.id}`)} style={styles.secondaryAction}><Text variant="meta" color={colors.brand}>Abrir atendimento</Text><ChevronRight size={15} color={colors.brand} /></Pressable>{call.address ? <Pressable onPress={() => verNoMapa(call)} style={styles.mapAction}><MapPin size={15} color={colors.textOnBrand} /><Text variant="meta" color={colors.textOnBrand}>Ver no mapa</Text></Pressable> : null}</View></View></Pressable>)}
        </>}
      </View>
    </ScrollView>

    {selected ? (
      <View style={[styles.rodape, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.rodapeInterno}>
          <View style={styles.operacao}>
            <ShieldCheck size={18} color={colors.brand} />
            <Text variant="meta" color={colors.textSecondary} style={styles.flex}>
              Status da operação: em deslocamento monitorado
            </Text>
          </View>

          <View style={styles.rodapeAcoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir GPS"
              onPress={() => {
                const a = selected.address;
                const destino = a ? `${a.street}, ${a.number ?? ''} ${a.city}` : '';
                Linking.openURL(`geo:0,0?q=${encodeURIComponent(destino)}`).catch(() => {
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`).catch(() => {});
                });
              }}
              style={({ pressed }) => [styles.gps, pressed && styles.pressed]}>
              <Navigation size={18} color={colors.textOnBrand} />
              <Text variant="microLabel" color={colors.textOnBrand}>Abrir GPS</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mensagem para o cliente"
              disabled={!selected.client?.phone}
              onPress={() => selected.client?.phone && Linking.openURL(`sms:${selected.client.phone}`).catch(() => {})}
              style={({ pressed }) => [styles.acaoQuadrada, pressed && styles.pressed, !selected.client?.phone && styles.inerte]}>
              <MessageCircle size={20} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ligar para o cliente"
              disabled={!selected.client?.phone}
              onPress={() => selected.client?.phone && Linking.openURL(`tel:${selected.client.phone}`).catch(() => {})}
              style={({ pressed }) => [styles.acaoQuadrada, styles.acaoUrgente, pressed && styles.pressed, !selected.client?.phone && styles.inerte]}>
              <Phone size={20} color={colors.dangerStrong} />
            </Pressable>
          </View>
        </View>
      </View>
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  mapArea: { height: 460, backgroundColor: '#E6EEF5', overflow: 'hidden', position: 'relative' },

  topBar: { position: 'absolute', top: 54, left: layout.screenPadding, right: layout.screenPadding, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', ...elevation.card },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgSurface, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...elevation.card },
  liveDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.success },

  eta: {
    position: 'absolute',
    top: 118,
    left: layout.screenPadding,
    right: layout.screenPadding,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
  etaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  etaBloco: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  etaSelo: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaDivisor: { width: 1, height: 32, backgroundColor: colors.border },
  etaStatus: { alignItems: 'center', gap: 2 },
  etaStatusLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  etaRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },

  rodape: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  rodapeInterno: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  operacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rodapeAcoes: { flexDirection: 'row', gap: spacing.md },
  gps: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  acaoQuadrada: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acaoUrgente: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  inerte: { opacity: 0.4 },
  flex: { flex: 1 },

  scroll: { flexGrow: 1, alignItems: 'center' },
  panel: { width: '100%', maxWidth: layout.maxContentWidth, marginTop: -24, backgroundColor: colors.bgSurface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: layout.screenPadding, gap: spacing.lg, minHeight: 420 },
  panelHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: radius.pill, backgroundColor: colors.slate300, marginTop: -8 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refresh: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandSoft, padding: spacing.md, borderRadius: radius.lg },
  stop: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md, backgroundColor: colors.bgSurface },
  stopSelected: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  stopRail: { width: 16, alignItems: 'center' },
  stopDot: { width: 12, height: 12, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.brand, backgroundColor: colors.bgSurface, marginTop: 3 },
  stopDotSelected: { backgroundColor: colors.brand },
  stopConnector: { width: 2, flex: 1, backgroundColor: colors.brandSoft, marginTop: spacing.sm, marginBottom: -spacing.md },
  stopContent: { flex: 1, gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stopActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryAction: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  mapAction: { minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});
