import { useLocalSearchParams, useRouter } from 'expo-router';
import { AirVent, Check, HardHat, MapPin, MessageCircle, Phone, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { Section } from '@/components/ui/Section';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  equipmentName,
  formatTime,
  STATUS_LABEL,
  STATUS_LIVE,
  STATUS_TONE,
} from '@/lib/format';
import { adminUpdateServiceCall, cancelMyServiceCall, fetchServiceCall, fetchStatusHistory, type ServiceCallDetailed } from '@/services/client';
import { fetchDistributionTechnicians, type DistributionTechnician } from '@/services/distribution';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';
import type { ServiceCallStatusHistory, ServiceStatus } from '@/types/database';

/** Etapas exibidas na timeline, na ordem do fluxo normal. */
const TIMELINE: ServiceStatus[] = [
  'aberto',
  'em_analise',
  'tecnico_atribuido',
  'a_caminho',
  'em_atendimento',
  'finalizado',
];

export default function AcompanharChamadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();

  const [call, setCall] = useState<ServiceCallDetailed | null>(null);
  const [history, setHistory] = useState<ServiceCallStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [diagnosisDraft, setDiagnosisDraft] = useState('');
  const [solutionDraft, setSolutionDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState<ServiceCallDetailed['priority']>('normal');
  const [statusDraft, setStatusDraft] = useState<ServiceCallDetailed['status']>('aberto');
  const [technicianDraft, setTechnicianDraft] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<DistributionTechnician[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [c, h] = await Promise.all([fetchServiceCall(id), fetchStatusHistory(id)]);
      setCall(c);
      setHistory(h);
      setTitleDraft(c.title);
      setDescriptionDraft(c.description ?? '');
      setDiagnosisDraft(c.diagnosis ?? '');
      setSolutionDraft(c.solution ?? '');
      setPriorityDraft(c.priority);
      setStatusDraft(c.status);
      setTechnicianDraft(c.technician_id);
      if (role === 'admin') { setTechnicians(await fetchDistributionTechnicians()); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o chamado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const tecnico = call?.technician?.profile?.full_name;
  const canCancel = role === 'cliente' && call && !['finalizado', 'cancelado'].includes(call.status);
  const canAdminEdit = role === 'admin';

  async function cancelCall() {
    if (!call) return;
    setSaving(true); setError(null);
    try { await cancelMyServiceCall(call.id, 'Cancelado pelo cliente'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível cancelar o chamado.'); }
    finally { setSaving(false); }
  }

  async function saveAdminChanges() {
    if (!call) return;
    setSaving(true); setError(null);
    try { await adminUpdateServiceCall({ callId: call.id, title: titleDraft, description: descriptionDraft, diagnosis: diagnosisDraft, solution: solutionDraft, priority: priorityDraft, status: statusDraft, technicianId: technicianDraft, setTechnician: true }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar os ajustes.'); }
    finally { setSaving(false); }
  }
  const whatsapp = null; // preenchido quando o telefone do técnico for exposto ao cliente

  return (
    <View style={styles.root}>
      <Header
        title={call ? `Chamado #${call.code}` : 'Chamado'}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(cliente)'))}
        trailing={
          call ? (
            <Badge
              label={STATUS_LABEL[call.status]}
              tone={STATUS_TONE[call.status]}
              live={STATUS_LIVE.includes(call.status)}
            />
          ) : undefined
        }
      />

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
          ) : error || !call ? (
            <ErrorState message={error ?? 'Chamado não encontrado.'} onRetry={load} />
          ) : (
            <>
              {call.equipment ? (
                <Card>
                  <View style={styles.row}>
                    <IconTile icon={AirVent} />
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{equipmentName(call.equipment)}</Text>
                      <Text variant="meta" color={colors.textSecondary}>
                        {[call.equipment.environment, call.address?.complement]
                          .filter(Boolean)
                          .join(' — ') || call.title}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}

              {call.status === 'a_caminho' ? (
                <Card style={styles.eta}>
                  <View style={styles.row}>
                    <View style={styles.etaIcone}>
                      <MapPin size={20} color={colors.textOnBrand} />
                    </View>
                    <View style={styles.flex}>
                      <Text variant="microLabel" color={colors.brandTint}>
                        Previsão de chegada
                      </Text>
                      <Text variant="cardTitle" color={colors.textOnBrand}>
                        {call.scheduled_for
                          ? `Às ${formatTime(call.scheduled_for)}`
                          : 'A caminho do local'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.etaFilete} />
                  <Text variant="meta" color={colors.brandTint}>
                    O técnico já está a caminho do endereço do atendimento.
                  </Text>
                </Card>
              ) : null}

              {tecnico ? (
                <Section label="Técnico responsável">
                  <Card>
                    <View style={styles.tecnico}>
                      <View style={styles.row}>
                        <IconTile icon={HardHat} />
                        <View style={styles.flex}>
                          <Text variant="cardTitle">{tecnico}</Text>
                          <Text variant="meta" color={colors.textSecondary}>
                            Técnico certificado
                          </Text>
                        </View>
                      </View>

                      <View style={styles.acoes}>
                        <View style={styles.flex}>
                          <Button
                            label="Ligar"
                            icon={Phone}
                            variant="secondary"
                            onPress={() => Linking.openURL('tel:')}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            label="WhatsApp"
                            icon={MessageCircle}
                            variant="success"
                            onPress={() =>
                              Linking.openURL(whatsapp ? `https://wa.me/${whatsapp}` : 'https://wa.me/')
                            }
                          />
                        </View>
                      </View>
                    </View>
                  </Card>
                </Section>
              ) : null}

              <Section label="Acompanhamento">
                <Card>
                  <Timeline current={call.status} history={history} />
                  {canCancel ? <Button label="Cancelar chamado" variant="danger" loading={saving} onPress={() => Alert.alert('Cancelar chamado', 'Deseja realmente cancelar este chamado?', [{ text: 'Voltar', style: 'cancel' }, { text: 'Cancelar chamado', style: 'destructive', onPress: () => { void cancelCall(); } }])} /> : null}
                </Card>
              </Section>

              {canAdminEdit ? <Section label="Ajustes administrativos"><Card><Text variant="microLabel" color={colors.textSecondary}>Prioridade</Text><View style={styles.choiceRow}>{(['baixa', 'normal', 'alta', 'urgente'] as const).map((value) => <Pressable key={value} onPress={() => setPriorityDraft(value)} style={[styles.choice, priorityDraft === value && styles.choiceActive]}><Text variant="meta" color={priorityDraft === value ? colors.textOnBrand : colors.textSecondary}>{value}</Text></Pressable>)}</View><Text variant="microLabel" color={colors.textSecondary}>Status permitido</Text><View style={styles.choiceWrap}>{(['aberto', 'em_analise', 'aguardando_tecnico', 'tecnico_atribuido', 'a_caminho', 'em_atendimento', 'aguardando_peca', 'aguardando_aprovacao', 'finalizado', 'cancelado'] as const).map((value) => <Pressable key={value} onPress={() => setStatusDraft(value)} style={[styles.choice, statusDraft === value && styles.choiceActive]}><Text variant="meta" color={statusDraft === value ? colors.textOnBrand : colors.textSecondary}>{value.replaceAll('_', ' ')}</Text></Pressable>)}</View><Text variant="microLabel" color={colors.textSecondary}>Técnico responsável</Text><View style={styles.choiceWrap}><Pressable onPress={() => setTechnicianDraft(null)} style={[styles.choice, technicianDraft === null && styles.choiceActive]}><Text variant="meta" color={technicianDraft === null ? colors.textOnBrand : colors.textSecondary}>Sem técnico</Text></Pressable>{technicians.map((tech) => <Pressable key={tech.technician_id} onPress={() => setTechnicianDraft(tech.technician_id)} style={[styles.choice, technicianDraft === tech.technician_id && styles.choiceActive]}><Text variant="meta" color={technicianDraft === tech.technician_id ? colors.textOnBrand : colors.textSecondary}>{tech.profile?.full_name ?? 'Técnico'}</Text></Pressable>)}</View><TextInput value={titleDraft} onChangeText={setTitleDraft} placeholder="Título" placeholderTextColor={colors.textMuted} style={styles.editorInput} /><TextInput value={descriptionDraft} onChangeText={setDescriptionDraft} placeholder="Descrição" placeholderTextColor={colors.textMuted} multiline style={[styles.editorInput, styles.multiline]} /><TextInput value={diagnosisDraft} onChangeText={setDiagnosisDraft} placeholder="Diagnóstico" placeholderTextColor={colors.textMuted} multiline style={[styles.editorInput, styles.multiline]} /><TextInput value={solutionDraft} onChangeText={setSolutionDraft} placeholder="Solução" placeholderTextColor={colors.textMuted} multiline style={[styles.editorInput, styles.multiline]} /><Button label="Salvar ajustes" loading={saving} onPress={() => { void saveAdminChanges(); }} /></Card></Section> : null}

              {call.ai_summary?.resumo ? (
                <Card accentBorder={colors.aiBorder}>
                  <View style={styles.resumo}>
                    <View style={styles.resumoHeader}>
                      <Sparkles size={16} color={colors.ai} />
                      <Text variant="microLabel" color={colors.aiStrong}>
                        Resumo da IA
                      </Text>
                    </View>
                    <Text variant="body" color={colors.textSecondary}>
                      {call.ai_summary.resumo}
                    </Text>
                  </View>
                </Card>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Timeline({
  current,
  history,
}: {
  current: ServiceStatus;
  history: ServiceCallStatusHistory[];
}) {
  const currentIndex = TIMELINE.indexOf(current);

  return (
    <View>
      {TIMELINE.map((status, index) => {
        const registro = history.find((h) => h.to_status === status);
        const concluida = currentIndex > index;
        const ativa = currentIndex === index;
        const cor = concluida ? colors.success : ativa ? colors.brand : colors.slate300;
        const ultima = index === TIMELINE.length - 1;

        const pendente = !concluida && !ativa;

        return (
          <View key={status} style={[styles.etapa, pendente && styles.etapaPendente]}>
            <View style={styles.marcadorColuna}>
              <View
                style={[
                  styles.marcador,
                  concluida && { backgroundColor: colors.successSoft },
                  ativa && { backgroundColor: colors.brandTint },
                  pendente && { backgroundColor: colors.slate200 },
                ]}>
                {/* Etapa vencida leva visto; a atual, o ponto vivo da marca. */}
                {concluida ? <Check size={12} color={colors.successStrong} strokeWidth={3} /> : null}
                {ativa ? <View style={styles.marcadorAtivo} /> : null}
              </View>
              {!ultima ? (
                <View
                  style={[
                    styles.conector,
                    { backgroundColor: concluida ? colors.success : colors.border },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.etapaTexto}>
              <Text variant={ativa ? 'cardTitle' : 'body'} color={ativa ? colors.brand : cor === colors.success ? colors.textPrimary : colors.textMuted}>
                {STATUS_LABEL[status]}
              </Text>
              <Text variant="meta" color={ativa ? colors.brand : colors.textMuted}>
                {registro ? formatTime(registro.created_at) : 'Pendente'}
              </Text>
            </View>
          </View>
        );
      })}
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
    gap: spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  tecnico: { gap: spacing.lg },
  acoes: { flexDirection: 'row', gap: spacing.md },
  resumo: { gap: spacing.md },
  resumoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  eta: { backgroundColor: colors.brand, borderColor: colors.brand, gap: spacing.md },
  etaIcone: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaFilete: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },

  etapa: { flexDirection: 'row', gap: spacing.lg },
  etapaPendente: { opacity: 0.4 },
  marcadorColuna: { alignItems: 'center', width: 20 },
  marcador: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcadorAtivo: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  conector: { width: 2, flex: 1, minHeight: 28, marginVertical: 2 },
  etapaTexto: { flex: 1, paddingBottom: spacing.xl, gap: 2 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.slate50 },
  choiceActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  editorInput: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, backgroundColor: colors.slate50, fontFamily: fonts.medium, fontSize: 14, marginBottom: spacing.sm },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
});
