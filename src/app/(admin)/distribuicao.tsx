import { useRouter } from 'expo-router';
import { BrainCircuit, CheckCircle2, RefreshCw, Save, SlidersHorizontal, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { distributeServiceCall, fetchDistributionRuns, fetchDistributionSettings, fetchDistributionTechnicians, fetchUnassignedServiceCalls, updateDistributionSettings, type DistributionRun, type DistributionSettings, type DistributionTechnician, type UnassignedServiceCall } from '@/services/distribution';

export default function DistributionAdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<DistributionSettings | null>(null);
  const [technicians, setTechnicians] = useState<DistributionTechnician[]>([]);
  const [runs, setRuns] = useState<DistributionRun[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedServiceCall[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextSettings, nextTechnicians, nextRuns, nextUnassigned] = await Promise.all([fetchDistributionSettings(), fetchDistributionTechnicians(), fetchDistributionRuns(), fetchUnassignedServiceCalls()]);
      setSettings(nextSettings); setTechnicians(nextTechnicians); setRuns(nextRuns); setUnassigned(nextUnassigned);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar a distribuição.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true); setSaved(false); setError(null);
    try { await updateDistributionSettings(settings.id, settings); setSaved(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar as regras.'); }
    finally { setSaving(false); }
  };

  const setNumber = (key: keyof DistributionSettings, text: string) => setSettings((current) => current ? { ...current, [key]: Number(text.replace(',', '.')) || 0 } : current);
  const assignManually = async (serviceCallId: string) => {
    setAssigningId(serviceCallId); setError(null);
    try { await distributeServiceCall(serviceCallId); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível distribuir o chamado.'); }
    finally { setAssigningId(null); }
  };

  return <View style={styles.root}>
    <Header title="Distribuição inteligente" eyebrow="JEmpreendimentos · Admin" trailing={<Pressable onPress={() => { setRefreshing(true); void load(); }} style={styles.refresh}><RefreshCw size={18} color={colors.brand} /></Pressable>} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
      <View style={styles.container}>
        <View style={styles.intro}><Text variant="screenTitle">Round Robin Inteligente</Text><Text variant="body" color={colors.textSecondary}>O sistema calcula o melhor técnico com base em disponibilidade, especialidade, carga, duração, localização e equilíbrio da fila.</Text></View>
        {loading ? <LoadingState /> : error && !settings ? <ErrorState message={error} onRetry={load} /> : settings ? <>
          <Card padded="md" style={styles.hero}><View style={styles.heroIcon}><BrainCircuit size={24} color={colors.brandStrong} /></View><View style={styles.flex}><Text variant="cardTitle">Distribuição automática ativa</Text><Text variant="meta" color={colors.textSecondary}>Novos chamados abertos são avaliados dentro das regras administrativas.</Text></View><Badge label="Ativo" tone="success" /></Card>

          <SectionTitle icon={SlidersHorizontal} title="Pesos do cálculo" />
          <Card padded="md" style={styles.formCard}>
            <NumberField label="Disponibilidade (%)" value={settings.weight_availability} onChangeText={(value) => setNumber('weight_availability', value)} />
            <NumberField label="Especialidade (%)" value={settings.weight_specialty} onChangeText={(value) => setNumber('weight_specialty', value)} />
            <NumberField label="Carga de trabalho (%)" value={settings.weight_workload} onChangeText={(value) => setNumber('weight_workload', value)} />
            <NumberField label="Tempo estimado (%)" value={settings.weight_duration} onChangeText={(value) => setNumber('weight_duration', value)} />
            <NumberField label="Localização (%)" value={settings.weight_location} onChangeText={(value) => setNumber('weight_location', value)} />
            <NumberField label="Round Robin (%)" value={settings.weight_round_robin} onChangeText={(value) => setNumber('weight_round_robin', value)} />
            <View style={styles.inlineFields}><NumberField label="Tempo padrão (min)" value={settings.default_duration_minutes} onChangeText={(value) => setNumber('default_duration_minutes', value)} /><NumberField label="Máx. simultâneos" value={settings.max_concurrent_calls} onChangeText={(value) => setNumber('max_concurrent_calls', value)} /></View>
            <ToggleRow label="Permitir técnico sem especialidade" value={settings.allow_without_specialty} onValueChange={(value) => setSettings({ ...settings, allow_without_specialty: value })} />
            <ToggleRow label="Permitir distribuição fora do horário" value={settings.allow_after_hours} onValueChange={(value) => setSettings({ ...settings, allow_after_hours: value })} />
            <Button label="Salvar regras" icon={Save} loading={saving} onPress={() => { void save(); }} />
            {saved ? <View style={styles.saved}><CheckCircle2 size={16} color={colors.successStrong} /><Text variant="meta" color={colors.successStrong}>Regras salvas com sucesso.</Text></View> : null}
          </Card>

          {unassigned.length > 0 ? <><SectionTitle icon={SlidersHorizontal} title="Chamados aguardando distribuição" />{unassigned.map((call) => <UnassignedCard key={call.id} call={call} loading={assigningId === call.id} onAssign={() => { void assignManually(call.id); }} />)}</> : null}

          <SectionTitle icon={UserRound} title="Técnicos elegíveis" />
          {technicians.length === 0 ? <Card><Text variant="body" color={colors.textSecondary}>Nenhum técnico ativo cadastrado.</Text></Card> : technicians.map((technician) => <TechnicianCard key={technician.technician_id} technician={technician} />)}

          <SectionTitle icon={BrainCircuit} title="Últimas decisões explicadas" />
          {runs.length === 0 ? <Card><Text variant="body" color={colors.textSecondary}>Ainda não há decisões registradas.</Text></Card> : runs.map((run) => <RunCard key={run.id} run={run} onPress={() => router.push(`/chamado/${run.service_call_id}`)} />)}
        </> : null}
      </View>
    </ScrollView>
  </View>;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof BrainCircuit; title: string }) { return <View style={styles.sectionTitle}><Icon size={18} color={colors.brandStrong} /><Text variant="bodyStrong">{title}</Text></View>; }
function NumberField({ label, value, onChangeText }: { label: string; value: number; onChangeText: (value: string) => void }) { return <View style={styles.field}><Text variant="meta" color={colors.textSecondary}>{label}</Text><TextInput value={String(value)} onChangeText={onChangeText} keyboardType="numeric" style={styles.input} /> </View>; }
function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.toggle}><Text variant="body">{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.slate300, true: colors.brandSoft }} thumbColor={value ? colors.brand : colors.bgSurface} /></View>; }
function UnassignedCard({ call, loading, onAssign }: { call: UnassignedServiceCall; loading: boolean; onAssign: () => void }) { return <Card padded="md"><View style={styles.rowBetween}><View style={styles.flex}><Text variant="cardTitle">#{call.code} · {call.title}</Text><Text variant="meta" color={colors.textSecondary}>{call.service_type} · prioridade {call.priority}</Text></View><Button label="Distribuir" loading={loading} onPress={onAssign} block={false} /></View></Card>; }
function TechnicianCard({ technician }: { technician: DistributionTechnician }) { return <Card padded="md"><View style={styles.rowBetween}><View style={styles.row}><View style={styles.avatar}><UserRound size={17} color={colors.brandStrong} /></View><View><Text variant="bodyStrong">{technician.profile?.full_name ?? 'Técnico'}</Text><Text variant="meta" color={colors.textSecondary}>{technician.specialties.length ? technician.specialties.join(' · ') : 'Sem especialidade configurada'}</Text></View></View><Badge label={technician.status === 'disponivel' ? 'Disponível' : 'Ocupado'} tone={technician.status === 'disponivel' ? 'success' : 'neutral'} /></View><Text variant="meta" color={colors.textSecondary}>Limite: {technician.max_concurrent_calls} chamados simultâneos{technician.service_area ? ` · Área: ${technician.service_area}` : ''}</Text></Card>; }
function RunCard({ run, onPress }: { run: DistributionRun; onPress: () => void }) { return <Card padded="md" onPress={onPress}><View style={styles.rowBetween}><Text variant="cardTitle">#{run.service_call?.code ?? '—'} · {run.service_call?.title ?? 'Chamado'}</Text><Badge label={run.technician?.profile?.full_name ?? 'Escalonar'} tone={run.selected_technician_id ? 'success' : 'danger'} /></View><Text variant="body" color={colors.textSecondary}>{run.explanation}</Text><Text variant="meta" color={colors.textMuted}>{run.estimated_duration_minutes} min estimados · {new Date(run.created_at).toLocaleString('pt-BR')}</Text></Card>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl, gap: spacing.lg }, intro: { gap: spacing.xs }, hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brandTint, borderColor: colors.brandSoft }, heroIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1, gap: spacing.xs }, formCard: { gap: spacing.md }, field: { flex: 1, gap: spacing.xs }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.bgSurface }, inlineFields: { flexDirection: 'row', gap: spacing.sm }, toggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border }, saved: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, avatar: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }, refresh: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
});
