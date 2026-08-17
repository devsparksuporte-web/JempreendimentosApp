import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, CheckCircle2, MapPin, Play, Square } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';
import { captureAndUploadPhoto, fetchChecklist, fetchChecklistResults, fetchServicePhotos, fetchTechnicianCall, saveChecklistResult, technicianUpdateServiceCall, updateTechnicianStatus, type ChecklistItem, type TechnicianCall, type TechnicianPhoto } from '@/services/technician';

export default function TechnicianCallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [call, setCall] = useState<TechnicianCall | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<TechnicianPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [diagnosisDraft, setDiagnosisDraft] = useState('');
  const [solutionDraft, setSolutionDraft] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const nextCall = await fetchTechnicianCall(id);
      const [checklist, saved, nextPhotos] = await Promise.all([fetchChecklist(nextCall.service_type), fetchChecklistResults(id), fetchServicePhotos(id)]);
      setCall(nextCall); setItems(checklist); setPhotos(nextPhotos); setResults(Object.fromEntries(saved.map((item) => [item.checklist_item_id, item.checked]))); setDescriptionDraft(nextCall.description ?? ''); setDiagnosisDraft(nextCall.diagnosis ?? ''); setSolutionDraft(nextCall.solution ?? '');
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o atendimento.'); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const beforeCount = useMemo(() => photos.filter((photo) => photo.stage === 'antes').length, [photos]);
  const afterCount = useMemo(() => photos.filter((photo) => photo.stage === 'depois').length, [photos]);
  const checklistComplete = items.filter((item) => item.required).every((item) => results[item.id]);

  async function changeStatus(status: TechnicianCall['status']) {
    if (!call) return;
    setBusy(true);
    try { await updateTechnicianStatus(call.id, status); await load(); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar o status.'); } finally { setBusy(false); }
  }

  async function addPhoto(stage: TechnicianPhoto['stage']) {
    if (!call) return;
    setBusy(true);
    try { const photo = await captureAndUploadPhoto(call, stage); if (photo) setPhotos((current) => [...current, photo]); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a foto.'); } finally { setBusy(false); }
  }

  async function saveAdjustments() {
    if (!call) return;
    setBusy(true); setError(null);
    try { await technicianUpdateServiceCall({ callId: call.id, description: descriptionDraft, diagnosis: diagnosisDraft, solution: solutionDraft }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar os ajustes.'); }
    finally { setBusy(false); }
  }

  async function toggleItem(item: ChecklistItem) {
    const checked = !results[item.id];
    setResults((current) => ({ ...current, [item.id]: checked }));
    try { await saveChecklistResult({ serviceCallId: call!.id, itemId: item.id, checked }); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o checklist.'); setResults((current) => ({ ...current, [item.id]: !checked })); }
  }

  if (loading) return <LoadingState />;
  if (error && !call) return <ErrorState message={error} onRetry={load} />;
  if (!call) return null;

  return <View style={styles.root}>
    <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={20} color={colors.textPrimary} /></Pressable><View style={styles.topTitle}><Text variant="screenTitle">Chamado #{call.code}</Text><Text variant="meta" color={colors.textSecondary}>Atendimento de campo</Text></View><Badge label={call.status} tone="info" /></View>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        {error ? <Card style={styles.error}><Text variant="body" color={colors.dangerStrong}>{error}</Text></Card> : null}
        <Card><Text variant="microLabel" color={colors.textSecondary}>Cliente</Text><Text variant="screenTitle">{call.client?.name ?? 'Cliente'}</Text><Text variant="body">{call.title}</Text>{call.address ? <View style={styles.row}><MapPin size={16} color={colors.brand} /><Text variant="body" color={colors.textSecondary}>{call.address.street}, {call.address.number ?? 's/n'} — {call.address.city}</Text></View> : null}</Card>
        <Card><Text variant="microLabel" color={colors.textSecondary}>Ajustes do atendimento</Text><TextInput value={descriptionDraft} onChangeText={setDescriptionDraft} placeholder="Descrição atualizada" placeholderTextColor={colors.textMuted} multiline style={styles.editorInput} /><TextInput value={diagnosisDraft} onChangeText={setDiagnosisDraft} placeholder="Diagnóstico técnico" placeholderTextColor={colors.textMuted} multiline style={styles.editorInput} /><TextInput value={solutionDraft} onChangeText={setSolutionDraft} placeholder="Solução aplicada" placeholderTextColor={colors.textMuted} multiline style={styles.editorInput} /><Button label="Salvar ajustes" variant="secondary" onPress={() => { void saveAdjustments(); }} loading={busy} /></Card>
        <Card><Text variant="microLabel" color={colors.textSecondary}>Equipamento</Text><Text variant="screenTitle">{call.equipment?.brand ?? 'Sem marca'} {call.equipment?.model ?? ''}</Text><Text variant="body" color={colors.textSecondary}>{call.equipment?.environment ?? 'Ambiente não informado'} · {call.equipment?.btu_capacity ? `${call.equipment.btu_capacity} BTU` : 'BTU não informado'} · Gás {call.equipment?.gas_type ?? 'não informado'}</Text></Card>
        <View style={styles.section}><Text variant="microLabel" color={colors.textSecondary}>Evidências obrigatórias</Text><View style={styles.photoGrid}><PhotoAction label={`Antes (${beforeCount})`} onPress={() => addPhoto('antes')} complete={beforeCount > 0} /><PhotoAction label={`Depois (${afterCount})`} onPress={() => addPhoto('depois')} complete={afterCount > 0} /></View></View>
        <View style={styles.section}><View style={styles.rowBetween}><Text variant="microLabel" color={colors.textSecondary}>Checklist técnico</Text><Badge label={`${Object.values(results).filter(Boolean).length}/${items.length}`} tone={checklistComplete ? 'success' : 'warning'} /></View>{items.length === 0 ? <Card><Text variant="body" color={colors.textSecondary}>Nenhum checklist cadastrado para este tipo de serviço.</Text></Card> : items.map((item) => <Pressable key={item.id} onPress={() => toggleItem(item)} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}><CheckCircle2 size={22} color={results[item.id] ? colors.success : colors.borderStrong} fill={results[item.id] ? colors.successSoft : 'transparent'} /><View style={styles.flex}><Text variant="bodyStrong">{item.label}</Text>{item.help_text ? <Text variant="meta" color={colors.textSecondary}>{item.help_text}</Text> : null}</View></Pressable>)}</View>
        <View style={styles.actions}>{call.status === 'aberto' ? <Button label="Aceitar chamado" icon={CheckCircle2} onPress={() => changeStatus('tecnico_atribuido')} loading={busy} /> : null}{call.status === 'tecnico_atribuido' || call.status === 'aguardando_tecnico' ? <Button label="Iniciar deslocamento" icon={Play} onPress={() => changeStatus('a_caminho')} loading={busy} /> : null}{call.status === 'a_caminho' ? <Button label="Iniciar atendimento" icon={Play} onPress={() => changeStatus('em_atendimento')} loading={busy} /> : null}{call.status === 'em_atendimento' ? <Button label={checklistComplete && beforeCount > 0 && afterCount > 0 ? 'Finalizar atendimento' : 'Complete checklist e fotos'} icon={Square} onPress={() => changeStatus('finalizado')} loading={busy} disabled={!checklistComplete || beforeCount === 0 || afterCount === 0} /> : null}</View>
      </View>
    </ScrollView>
  </View>;
}

function PhotoAction({ label, onPress, complete }: { label: string; onPress: () => void; complete: boolean }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.photoAction, complete && styles.photoComplete, pressed && styles.pressed]}><Camera size={24} color={complete ? colors.successStrong : colors.brandStrong} /><Text variant="bodyStrong" color={complete ? colors.successStrong : colors.brandStrong}>{label}</Text><Text variant="meta" color={colors.textSecondary}>{complete ? 'Registrada' : 'Obrigatória'}</Text></Pressable>; }

const styles = StyleSheet.create({ editorInput: { minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.slate50, fontFamily: fonts.medium, fontSize: 14, textAlignVertical: 'top', marginTop: spacing.sm }, root: { flex: 1, backgroundColor: colors.bgApp }, top: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bgSurface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.slate50, alignItems: 'center', justifyContent: 'center' }, topTitle: { flex: 1, gap: 2 }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, padding: layout.screenPadding, gap: spacing.lg }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, section: { gap: spacing.md }, photoGrid: { flexDirection: 'row', gap: spacing.md }, photoAction: { flex: 1, minHeight: 132, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brandSoft, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md }, photoComplete: { backgroundColor: colors.successSoft, borderColor: colors.success }, checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.sm }, flex: { flex: 1, gap: spacing.xs }, actions: { gap: spacing.md }, error: { backgroundColor: colors.dangerSoft, borderColor: colors.danger }, pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] } });
