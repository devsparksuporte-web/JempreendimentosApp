import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, AlertCircle, AlertTriangle, ArrowLeft, Calendar, Camera, CheckCircle2, ClipboardCheck, ClipboardList, FileText, Info, MapPin, PenLine, Phone, Play, SearchCheck, Square, UserCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ConversaChamado } from '@/components/ConversaChamado';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/IconTile';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatDate, formatTime } from '@/lib/format';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';
import { captureAndUploadPhoto, fetchChecklist, fetchChecklistResults, fetchServicePhotos, fetchTechnicianCall, saveChecklistResult, technicianUpdateServiceCall, updateTechnicianStatus, type ChecklistItem, type TechnicianCall, type TechnicianPhoto } from '@/services/technician';
import type { EquipmentConditionLevel } from '@/types/database';

/** As três condições do design, na mesma ordem e com as mesmas cores. */
const CONDICOES: {
  valor: EquipmentConditionLevel;
  rotulo: string;
  ajuda: string;
  cor: string;
  fundo: string;
  icone: typeof AlertCircle;
}[] = [
  {
    valor: 'critica',
    rotulo: 'Crítica',
    ajuda: 'Precisa de atenção imediata e urgente.',
    cor: colors.danger,
    fundo: colors.dangerSoft,
    icone: AlertCircle,
  },
  {
    valor: 'alerta',
    rotulo: 'Alerta',
    ajuda: 'Funciona, mas requer reparos em breve.',
    cor: colors.warning,
    fundo: colors.warningSoft,
    icone: AlertTriangle,
  },
  {
    valor: 'otimo',
    rotulo: 'Ótimo',
    ajuda: 'Tudo em ordem, pronto para operar.',
    cor: colors.success,
    fundo: colors.successSoft,
    icone: CheckCircle2,
  },
];

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
  const [condicaoDraft, setCondicaoDraft] = useState<EquipmentConditionLevel | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const nextCall = await fetchTechnicianCall(id);
      const [checklist, saved, nextPhotos] = await Promise.all([fetchChecklist(nextCall.service_type), fetchChecklistResults(id), fetchServicePhotos(id)]);
      setCall(nextCall); setItems(checklist); setPhotos(nextPhotos); setResults(Object.fromEntries(saved.map((item) => [item.checklist_item_id, item.checked]))); setDescriptionDraft(nextCall.description ?? ''); setDiagnosisDraft(nextCall.diagnosis ?? ''); setSolutionDraft(nextCall.solution ?? ''); setCondicaoDraft(nextCall.equipment_condition ?? null);
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
    try { await technicianUpdateServiceCall({ callId: call.id, description: descriptionDraft, diagnosis: diagnosisDraft, solution: solutionDraft, equipmentCondition: condicaoDraft }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar os ajustes.'); }
    finally { setBusy(false); }
  }

  async function toggleItem(item: ChecklistItem) {
    const checked = !results[item.id];
    setResults((current) => ({ ...current, [item.id]: checked }));
    try { await saveChecklistResult({ serviceCallId: call!.id, itemId: item.id, checked }); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o checklist.'); setResults((current) => ({ ...current, [item.id]: !checked })); }
  }

  /**
   * O atendimento tem uma acao obvia por status. O design faz dela o centro da
   * tela, entao ela e resolvida aqui e desenhada dentro do cartao de check-in.
   */
  const acao = (() => {
    if (!call) return { titulo: 'Atendimento', botao: null };
    if (call.status === 'aberto')
      return { titulo: 'Aceitar chamado', botao: <Button label="Aceitar chamado" icon={CheckCircle2} onPress={() => changeStatus('tecnico_atribuido')} loading={busy} /> };
    if (call.status === 'tecnico_atribuido' || call.status === 'aguardando_tecnico')
      return { titulo: 'Iniciar deslocamento', botao: <Button label="Iniciar deslocamento" icon={Play} onPress={() => changeStatus('a_caminho')} loading={busy} /> };
    if (call.status === 'a_caminho')
      return { titulo: 'Iniciar atendimento', botao: <Button label="Iniciar atendimento" icon={Play} onPress={() => changeStatus('em_atendimento')} loading={busy} /> };
    if (call.status === 'em_atendimento') {
      const pronto = checklistComplete && beforeCount > 0 && afterCount > 0;
      return {
        titulo: 'Finalizar atendimento',
        botao: <Button label={pronto ? 'Finalizar atendimento' : 'Complete checklist e fotos'} icon={Square} onPress={() => changeStatus('finalizado')} loading={busy} disabled={!pronto} />,
      };
    }
    return { titulo: 'Atendimento', botao: null };
  })();

  if (loading) return <LoadingState />;
  if (error && !call) return <ErrorState message={error} onRetry={load} />;
  if (!call) return null;

  return <View style={styles.root}>
    <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={20} color={colors.textPrimary} /></Pressable><View style={styles.topTitle}><Text variant="screenTitle">Chamado #{call.code}</Text><Text variant="meta" color={colors.textSecondary}>Atendimento de campo</Text></View><Badge label={call.status} tone="info" /></View>
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        {error ? <Card style={styles.error}><Text variant="body" color={colors.dangerStrong}>{error}</Text></Card> : null}
        {/* Cartao de check-in: e o passo do momento, entao abre a tela. */}
        <Card style={styles.checkin}>
          <View style={styles.checkinTopo}>
            <IconTile icon={ClipboardCheck} size="md" />
            <Text variant="screenTitle" style={styles.checkinTitulo}>{acao.titulo}</Text>
            <Text variant="microLabel" color={colors.textSecondary}>Confirmação de acesso técnico</Text>
          </View>

          <View style={styles.checkinLinhas}>
            <LinhaInfo icone={UserCheck} rotulo="Check-in" valor={call.client?.name ?? 'Cliente'} />
            <LinhaInfo icone={Calendar} rotulo="Data e horário" valor={call.scheduled_for ? `${formatDate(call.scheduled_for)} às ${formatTime(call.scheduled_for)}` : 'Sem agendamento'} />
            {call.address ? <LinhaInfo icone={MapPin} rotulo="Geolocalização" valor={`${call.address.street}, ${call.address.number ?? 's/n'} — ${call.address.city}`} /> : null}
          </View>

          {acao.botao}
        </Card>

        <View style={styles.section}>
          <Text variant="microLabel" color={colors.textSecondary}>Informações da unidade</Text>
          <Card>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>Cliente</Text>
                <Text variant="cardTitle">{call.client?.name ?? 'Cliente'}</Text>
                <Text variant="body" color={colors.textSecondary}>{call.title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ligar para o cliente"
                disabled={!call.client?.phone}
                onPress={() => call.client?.phone && Linking.openURL(`tel:${call.client.phone}`).catch(() => {})}
                style={({ pressed }) => [styles.ligar, pressed && styles.pressed, !call.client?.phone && styles.inerte]}>
                <Phone size={18} color={colors.brandStrong} />
              </Pressable>
            </View>

            <View style={styles.gradeUnidade}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>Equipamento</Text>
                <Text variant="bodyStrong">{[call.equipment?.brand, call.equipment?.model].filter(Boolean).join(' ') || 'Não informado'}</Text>
              </View>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>Patrimônio</Text>
                <Text variant="bodyStrong" style={styles.patrimonio}>{call.equipment?.serial_number ?? '—'}</Text>
              </View>
            </View>
          </Card>
        </View>
        {/* Formulario de diagnostico: cada campo com seu proprio rotulo e
            explicacao, como no design da Analise Tecnica. */}
        <Card style={styles.diagnostico}>
          <View style={styles.diagnosticoTopo}>
            <IconTile icon={SearchCheck} size="md" />
            <Text variant="cardTitle">Dados do diagnóstico</Text>
            <Text variant="microLabel" color={colors.textSecondary}>
              Chamado #{call.code}
              {call.equipment?.brand ? ` · ${call.equipment.brand} ${call.equipment.model ?? ''}`.trimEnd() : ''}
            </Text>
          </View>

          <CampoTecnico
            icone={ClipboardList}
            rotulo="Defeito identificado"
            ajuda="Campo obrigatório para o relatório técnico"
            valor={descriptionDraft}
            onChange={setDescriptionDraft}
            placeholder="Descreva a falha principal…"
          />
          <View style={styles.campo}>
            <View style={styles.campoCabecalho}>
              <Activity size={16} color={colors.brandStrong} />
              <Text variant="microLabel">Status de operação</Text>
            </View>
            <Text variant="meta" color={colors.textMuted}>Avaliação da condição física</Text>

            <View style={styles.condicoes}>
              {CONDICOES.map((c) => {
                const ativa = condicaoDraft === c.valor;
                const Icone = c.icone;
                return (
                  <Pressable
                    key={c.valor}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ativa }}
                    // Tocar de novo na opção marcada desmarca: o técnico pode
                    // ter errado o toque e não deve ficar preso a um laudo.
                    onPress={() => setCondicaoDraft(ativa ? null : c.valor)}
                    style={({ pressed }) => [
                      styles.condicao,
                      ativa && { borderColor: c.cor, backgroundColor: c.fundo },
                      pressed && styles.pressed,
                    ]}>
                    <View style={[styles.condicaoMarca, ativa && { borderColor: c.cor, backgroundColor: c.cor }]} />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong">{c.rotulo}</Text>
                      <Text variant="meta" color={colors.textSecondary}>{c.ajuda}</Text>
                    </View>
                    <Icone size={20} color={c.cor} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <CampoTecnico
            icone={SearchCheck}
            rotulo="Diagnóstico técnico"
            ajuda="O que a inspeção constatou"
            valor={diagnosisDraft}
            onChange={setDiagnosisDraft}
            placeholder="O que foi constatado na inspeção…"
          />
          <CampoTecnico
            icone={FileText}
            rotulo="Solução aplicada"
            ajuda="Informações complementares e peças"
            valor={solutionDraft}
            onChange={setSolutionDraft}
            placeholder="O que foi feito para resolver…"
          />

          <Button label="Salvar ajustes" variant="secondary" onPress={() => { void saveAdjustments(); }} loading={busy} />
        </Card>

        {/* Aviso de seguranca do design — o tecnico le antes de medir. */}
        <View style={styles.protocolo}>
          <Info size={24} color={colors.brandStrong} />
          <View style={styles.flex}>
            <Text variant="microLabel" color={colors.brandStrong}>Protocolo de segurança</Text>
            <Text variant="body" color={colors.textSecondary}>
              Garanta a desenergização total do barramento antes de iniciar as medições.
              Mantenha os EPIs em conformidade.
            </Text>
          </View>
        </View>
        <Card><Text variant="microLabel" color={colors.textSecondary}>Equipamento</Text><Text variant="screenTitle">{call.equipment?.brand ?? 'Sem marca'} {call.equipment?.model ?? ''}</Text><Text variant="body" color={colors.textSecondary}>{call.equipment?.environment ?? 'Ambiente não informado'} · {call.equipment?.btu_capacity ? `${call.equipment.btu_capacity} BTU` : 'BTU não informado'} · Gás {call.equipment?.gas_type ?? 'não informado'}</Text></Card>
        <View style={styles.section}><Text variant="microLabel" color={colors.textSecondary}>Evidências obrigatórias</Text><View style={styles.photoGrid}><PhotoAction label={`Antes (${beforeCount})`} onPress={() => addPhoto('antes')} complete={beforeCount > 0} /><PhotoAction label={`Depois (${afterCount})`} onPress={() => addPhoto('depois')} complete={afterCount > 0} /></View></View>
        <View style={styles.section}><View style={styles.rowBetween}><Text variant="microLabel" color={colors.textSecondary}>Checklist técnico</Text><Badge label={`${Object.values(results).filter(Boolean).length}/${items.length}`} tone={checklistComplete ? 'success' : 'warning'} /></View>{items.length === 0 ? <Card><Text variant="body" color={colors.textSecondary}>Nenhum checklist cadastrado para este tipo de serviço.</Text></Card> : items.map((item) => <Pressable key={item.id} onPress={() => toggleItem(item)} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}><CheckCircle2 size={22} color={results[item.id] ? colors.success : colors.borderStrong} fill={results[item.id] ? colors.successSoft : 'transparent'} /><View style={styles.flex}><Text variant="bodyStrong">{item.label}</Text>{item.help_text ? <Text variant="meta" color={colors.textSecondary}>{item.help_text}</Text> : null}</View></Pressable>)}</View>

        {/* A tela de assinatura existia desde o começo e nenhum caminho levava
            até ela — o técnico não tinha como colher a assinatura do cliente.
            Fica aqui, depois das evidências: é o aceite do que foi feito. */}
        <View style={styles.section}>
          <Text variant="microLabel" color={colors.textSecondary}>
            Aceite do cliente
          </Text>
          <Button
            label="Colher assinatura do cliente"
            icon={PenLine}
            variant="secondary"
            onPress={() => router.push(`/(tecnico)/assinatura/${call.id}` as never)}
          />
        </View>

        {id ? <ConversaChamado callId={id} /> : null}
      </View>
    </ScrollView>
  </View>;
}

function CampoTecnico({
  icone: Icone,
  rotulo,
  ajuda,
  valor,
  onChange,
  placeholder,
}: {
  icone: typeof MapPin;
  rotulo: string;
  ajuda: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.campo}>
      <View style={styles.campoCabecalho}>
        <Icone size={16} color={colors.brandStrong} />
        <Text variant="microLabel">{rotulo}</Text>
      </View>
      <Text variant="meta" color={colors.textMuted}>{ajuda}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.editorInput}
      />
    </View>
  );
}

function LinhaInfo({ icone: Icone, rotulo, valor }: { icone: typeof MapPin; rotulo: string; valor: string }) {
  return (
    <View style={styles.linhaInfo}>
      <View style={styles.linhaInfoIcone}><Icone size={18} color={colors.brandStrong} /></View>
      <View style={styles.flex}>
        <Text variant="microLabel" color={colors.textSecondary}>{rotulo}</Text>
        <Text variant="bodyStrong" numberOfLines={2}>{valor}</Text>
      </View>
    </View>
  );
}

function PhotoAction({ label, onPress, complete }: { label: string; onPress: () => void; complete: boolean }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.photoAction, complete && styles.photoComplete, pressed && styles.pressed]}><Camera size={24} color={complete ? colors.successStrong : colors.brandStrong} /><Text variant="bodyStrong" color={complete ? colors.successStrong : colors.brandStrong}>{label}</Text><Text variant="meta" color={colors.textSecondary}>{complete ? 'Registrada' : 'Obrigatória'}</Text></Pressable>; }

const styles = StyleSheet.create({ editorInput: { minHeight: 76, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.slate50, fontFamily: fonts.medium, fontSize: 14, textAlignVertical: 'top', marginTop: spacing.sm }, root: { flex: 1, backgroundColor: colors.bgApp }, top: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.bgSurface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.slate50, alignItems: 'center', justifyContent: 'center' }, topTitle: { flex: 1, gap: 2 }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, padding: layout.screenPadding, gap: spacing.lg }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, section: { gap: spacing.md }, photoGrid: { flexDirection: 'row', gap: spacing.md }, photoAction: { flex: 1, minHeight: 132, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brandSoft, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md }, photoComplete: { backgroundColor: colors.successSoft, borderColor: colors.success }, checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.sm }, flex: { flex: 1, gap: spacing.xs }, actions: { gap: spacing.md }, diagnostico: { gap: spacing.lg }, diagnosticoTopo: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm }, campo: { gap: spacing.xs }, condicoes: { gap: spacing.sm, marginTop: spacing.sm }, condicao: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md }, condicaoMarca: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.slate300 }, campoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, protocolo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandSoft, borderRadius: radius.xl, padding: spacing.lg }, checkin: { gap: spacing.xl }, checkinTopo: { alignItems: 'center', gap: spacing.sm }, checkinTitulo: { textAlign: 'center', textTransform: 'uppercase' }, checkinLinhas: { gap: spacing.md }, linhaInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }, linhaInfoIcone: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, ligar: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, inerte: { opacity: 0.4 }, gradeUnidade: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.slate100 }, patrimonio: { fontFamily: fonts.bold, letterSpacing: 1 }, error: { backgroundColor: colors.dangerSoft, borderColor: colors.danger }, pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] } });
