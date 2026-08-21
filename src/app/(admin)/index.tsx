import { useRouter } from 'expo-router';
import { AlertCircle, BarChart3, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, FileCheck2, HardHat, LayoutGrid, MessageCircle, MonitorPlay, PackageCheck, PackageSearch, RefreshCw, Truck, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CardGrid } from '@/components/ui/CardGrid';
import { Header } from '@/components/ui/Header';
import { SinoNotificacoes } from '@/components/ui/SinoNotificacoes';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
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

  /** Primeiro chamado com horário marcado — o "próximo serviço" do design. */
  const proximo = data?.calls
    .filter((c) => c.scheduled_for)
    .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))[0]
    ?? data?.calls[0]
    ?? null;

  return (
    <View style={styles.root}>
      <Header
        title="Painel operacional"
        eyebrow="JEmpreendimentos · Admin"
        trailing={
          <View style={styles.headerAcoes}>
            <View style={styles.operacao}>
              <View style={styles.operacaoPonto} />
              <Text variant="meta" color={colors.brandStrong}>Operação ativa</Text>
            </View>
            <SinoNotificacoes />
            <Pressable accessibilityRole="button" accessibilityLabel="Atualizar" onPress={load} style={styles.refresh}>
              <RefreshCw size={18} color={colors.brand} />
            </Pressable>
          </View>
        }
      />
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
              <View style={styles.destaques}>
                <Destaque
                  icon={LayoutGrid}
                  rotulo="Chamados abertos"
                  valor={String(data.totals.open)}
                  apoio={
                    data.totals.urgent > 0
                      ? `${data.totals.urgent} urgente(s) na fila`
                      : 'Aguardando alocação técnica'
                  }
                  destaqueApoio={data.totals.urgent > 0 ? colors.dangerStrong : colors.textMuted}
                />

                <Destaque
                  icon={CalendarClock}
                  rotulo="Próximo serviço"
                  valor={proximo?.client?.name ?? 'Nada agendado'}
                  valorPequeno
                  apoio={
                    proximo?.scheduled_for
                      ? `Agendamento: ${formatTime(proximo.scheduled_for)}`
                      : 'Sem horário definido'
                  }
                  destaqueApoio={colors.brand}
                />

                <Destaque
                  icon={HardHat}
                  rotulo="Equipe disponível"
                  valor={String(data.totals.techniciansAvailable)}
                  apoio={`${data.technicians.length} técnico(s) ativos`}
                  destaqueApoio={colors.successStrong}
                />
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
                <Pressable onPress={() => router.push('/(admin)/clientes' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><UserRound size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Clientes e equipamentos</Text><Text variant="meta" color={colors.textSecondary}>Cadastro, endereços e aparelhos</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/tecnicos' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><HardHat size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Técnicos em tempo real</Text><Text variant="meta" color={colors.textSecondary}>Equipe no mapa e status</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/pmoc' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><FileCheck2 size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">PMOC e conformidade</Text><Text variant="meta" color={colors.textSecondary}>Rotinas e próximas execuções</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/estoque' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><PackageSearch size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Controle de estoque</Text><Text variant="meta" color={colors.textSecondary}>Saldo mínimo e reposição</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/reposicao' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><Truck size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Reposição de estoque</Text><Text variant="meta" color={colors.textSecondary}>Solicitações e fornecedores</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/recebimento' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><PackageCheck size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Recebimento de mercadoria</Text><Text variant="meta" color={colors.textSecondary}>Pedidos de compra e entrada no estoque</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/relatorios' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><BarChart3 size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Relatórios</Text><Text variant="meta" color={colors.textSecondary}>Performance e analytics</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/whatsapp' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><MessageCircle size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Central WhatsApp</Text><Text variant="meta" color={colors.textSecondary}>Triagem de conversas</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
                <Pressable onPress={() => router.push('/(admin)/painel' as never)} style={({ pressed }) => [styles.operationLink, pressed && styles.pressed]}><MonitorPlay size={20} color={colors.brandStrong} /><View style={styles.flex}><Text variant="bodyStrong">Painel de operação</Text><Text variant="meta" color={colors.textSecondary}>Modo TV, leitura à distância</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>
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

/**
 * Cartão grande do painel: rótulo pequeno, número gigante e uma linha de
 * apoio. É a unidade de leitura do design do dashboard.
 */
function Destaque({
  icon: Icon,
  rotulo,
  valor,
  apoio,
  destaqueApoio,
  valorPequeno = false,
}: {
  icon: typeof ClipboardList;
  rotulo: string;
  valor: string;
  apoio: string;
  destaqueApoio: string;
  valorPequeno?: boolean;
}) {
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.destaqueTextos}>
          <Text variant="microLabel" color={colors.textSecondary}>{rotulo}</Text>
          <Text variant={valorPequeno ? 'cardTitle' : 'kpi'} numberOfLines={1}>{valor}</Text>
          <Text variant="meta" color={destaqueApoio}>{apoio}</Text>
        </View>
        <View style={styles.destaqueIcone}>
          <Icon size={26} color={colors.brand} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl, gap: spacing.lg },
  intro: { gap: spacing.xs },
  destaques: { gap: spacing.md },
  destaqueTextos: { flex: 1, gap: 2 },
  destaqueIcone: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAcoes: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  operacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  operacaoPonto: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
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
