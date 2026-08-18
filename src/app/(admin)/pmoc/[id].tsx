import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AirVent,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Printer,
  Share2,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CardGrid } from '@/components/ui/CardGrid';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { Section } from '@/components/ui/Section';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { daysUntilLabel, formatDate } from '@/lib/format';
import {
  emitirCertificado,
  execucoesNoPeriodo,
  fetchCertificados,
  fetchPmocPlan,
  registrarExecucao,
  type PmocCertificate,
  type PmocItem,
  type PmocPlan,
} from '@/services/pmoc';
import { gerarPdf, imprimir } from '@/services/pmocCertificado';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/** Período padrão do certificado: os últimos 12 meses. */
function periodoPadrao() {
  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setFullYear(inicio.getFullYear() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: iso(inicio), fim: iso(fim) };
}

export default function PmocDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<PmocPlan | null>(null);
  const [certificados, setCertificados] = useState<PmocCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [executando, setExecutando] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [p, c] = await Promise.all([fetchPmocPlan(id), fetchCertificados(id)]);
      setPlan(p);
      setCertificados(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o plano.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function executar(item: PmocItem, conforme: boolean) {
    setExecutando(item.id);
    try {
      await registrarExecucao({ itemId: item.id, conforme });
      await load();
    } catch (e) {
      Alert.alert('Não foi possível registrar', e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setExecutando(null);
    }
  }

  async function emitir() {
    if (!plan) return;
    const { inicio, fim } = periodoPadrao();
    const registros = execucoesNoPeriodo(plan, inicio, fim);

    if (registros.length === 0) {
      Alert.alert(
        'Sem execuções no período',
        'O certificado ficaria sem nenhum registro de manutenção — é justamente isso que a fiscalização verifica. Registre ao menos uma rotina antes de emitir.',
      );
      return;
    }

    setEmitindo(true);
    try {
      const certificado = await emitirCertificado({
        plan,
        periodStart: inicio,
        periodEnd: fim,
        signerName: plan.client?.name ?? '',
      });
      await load();
      await gerarPdf(plan, certificado);
    } catch (e) {
      Alert.alert('Falha ao emitir', e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setEmitindo(false);
    }
  }

  async function reabrir(certificado: PmocCertificate, imprimirDireto: boolean) {
    if (!plan) return;
    try {
      if (imprimirDireto) await imprimir(plan, certificado);
      else await gerarPdf(plan, certificado);
    } catch (e) {
      Alert.alert('Falha ao abrir', e instanceof Error ? e.message : 'Erro inesperado.');
    }
  }

  const { inicio, fim } = periodoPadrao();
  const totalPeriodo = plan ? execucoesNoPeriodo(plan, inicio, fim).length : 0;

  return (
    <View style={styles.root}>
      <Header
        title={plan?.title ?? 'PMOC'}
        eyebrow="Plano de manutenção"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(admin)/pmoc'))}
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
          ) : error || !plan ? (
            <ErrorState message={error ?? 'Plano não encontrado.'} onRetry={load} />
          ) : (
            <>
              <Card>
                <View style={styles.bloco}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Estabelecimento
                  </Text>
                  <Text variant="cardTitle">{plan.client?.name ?? 'Cliente não informado'}</Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    {plan.address
                      ? `${plan.address.street}${plan.address.number ? `, ${plan.address.number}` : ''} — ${plan.address.city}`
                      : 'Endereço não informado'}
                  </Text>
                  <View style={styles.divisor} />
                  <View style={styles.linha}>
                    <Text variant="meta" color={colors.textSecondary}>
                      Responsável técnico
                    </Text>
                    <Text variant="bodyStrong">
                      {plan.responsible?.profile?.full_name ?? 'Não definido'}
                    </Text>
                  </View>
                  <View style={styles.linha}>
                    <Text variant="meta" color={colors.textSecondary}>
                      Vigência
                    </Text>
                    <Text variant="bodyStrong">
                      {formatDate(plan.start_date)} — {plan.end_date ? formatDate(plan.end_date) : 'aberta'}
                    </Text>
                  </View>
                </View>
              </Card>

              <Section label={`Rotinas do plano (${plan.items.length})`}>
                <CardGrid>
                  {plan.items.map((item) => {
                    const atrasada =
                      item.next_execution && new Date(item.next_execution).getTime() < Date.now();
                    return (
                      <Card key={item.id} padded="md">
                        <View style={styles.bloco}>
                          <View style={styles.row}>
                            <IconTile icon={AirVent} size="md" />
                            <View style={styles.flex}>
                              <Text variant="cardTitle" numberOfLines={1}>
                                {item.equipment?.brand ?? 'Equipamento'}
                                {item.equipment?.btu_capacity
                                  ? ` ${item.equipment.btu_capacity.toLocaleString('pt-BR')} BTUs`
                                  : ''}
                              </Text>
                              <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                                {item.equipment?.environment ?? 'Ambiente não informado'}
                              </Text>
                            </View>
                            <Badge
                              label={atrasada ? 'Atrasada' : 'Em dia'}
                              tone={atrasada ? 'danger' : 'success'}
                            />
                          </View>

                          <Text variant="bodyStrong">{item.routine}</Text>
                          <View style={styles.metaRow}>
                            <CalendarClock size={14} color={colors.textMuted} />
                            <Text variant="meta" color={colors.textSecondary}>
                              A cada {item.frequency_months}{' '}
                              {item.frequency_months === 1 ? 'mês' : 'meses'} · próxima{' '}
                              {formatDate(item.next_execution)}
                              {item.next_execution ? ` (${daysUntilLabel(item.next_execution)})` : ''}
                            </Text>
                          </View>

                          <View style={styles.acoes}>
                            <Pressable
                              disabled={executando === item.id}
                              onPress={() => executar(item, true)}
                              style={({ pressed }) => [
                                styles.acao,
                                styles.acaoOk,
                                pressed && styles.pressed,
                              ]}>
                              <CheckCircle2 size={15} color={colors.successStrong} />
                              <Text variant="meta" color={colors.successStrong}>
                                {executando === item.id ? 'Registrando…' : 'Conforme'}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={executando === item.id}
                              onPress={() => executar(item, false)}
                              style={({ pressed }) => [
                                styles.acao,
                                styles.acaoFalha,
                                pressed && styles.pressed,
                              ]}>
                              <XCircle size={15} color={colors.dangerStrong} />
                              <Text variant="meta" color={colors.dangerStrong}>
                                Não conforme
                              </Text>
                            </Pressable>
                          </View>

                          {item.executions?.length ? (
                            <Text variant="meta" color={colors.textMuted}>
                              {item.executions.length}{' '}
                              {item.executions.length === 1 ? 'execução registrada' : 'execuções registradas'}
                            </Text>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </CardGrid>
              </Section>

              <Section label="Certificado para fiscalização">
                <Card accentBorder={colors.brandSoft}>
                  <View style={styles.bloco}>
                    <View style={styles.row}>
                      <IconTile icon={FileCheck2} />
                      <View style={styles.flex}>
                        <Text variant="microLabel" color={colors.textSecondary}>
                          Período dos últimos 12 meses
                        </Text>
                        <Text variant="cardTitle">
                          {formatDate(inicio)} — {formatDate(fim)}
                        </Text>
                        <Text variant="meta" color={colors.textSecondary}>
                          {totalPeriodo}{' '}
                          {totalPeriodo === 1 ? 'execução no período' : 'execuções no período'}
                        </Text>
                      </View>
                    </View>
                    <Button
                      label={emitindo ? 'Emitindo…' : 'Emitir certificado'}
                      icon={FileCheck2}
                      onPress={emitir}
                      loading={emitindo}
                    />
                  </View>
                </Card>

                {certificados.map((c) => (
                  <Card key={c.id} padded="md">
                    <View style={styles.bloco}>
                      <View style={styles.row}>
                        <View style={styles.flex}>
                          <Text variant="cardTitle">{c.number}</Text>
                          <Text variant="meta" color={colors.textSecondary}>
                            {formatDate(c.period_start)} — {formatDate(c.period_end)} · emitido em{' '}
                            {formatDate(c.issued_at)}
                          </Text>
                        </View>
                        <Badge label="Emitido" tone="success" />
                      </View>
                      <View style={styles.acoes}>
                        <Pressable
                          onPress={() => reabrir(c, false)}
                          style={({ pressed }) => [styles.acao, pressed && styles.pressed]}>
                          <Share2 size={15} color={colors.brand} />
                          <Text variant="meta" color={colors.brand}>
                            Abrir PDF
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => reabrir(c, true)}
                          style={({ pressed }) => [styles.acao, pressed && styles.pressed]}>
                          <Printer size={15} color={colors.brand} />
                          <Text variant="meta" color={colors.brand}>
                            Imprimir
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                ))}
              </Section>
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
    gap: spacing.xl,
  },
  bloco: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  divisor: { height: 1, backgroundColor: colors.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  acoes: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  acaoOk: { borderColor: colors.successSoft, backgroundColor: colors.successSoft },
  acaoFalha: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
