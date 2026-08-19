import { useRouter } from 'expo-router';
import { ClipboardList, MapPin, Plus, Search, Star } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CardGrid } from '@/components/ui/CardGrid';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  equipmentName,
  formatDate,
  STATUS_LABEL,
  STATUS_LIVE,
  STATUS_TONE,
} from '@/lib/format';
import {
  fetchMyServiceCalls,
  notaDoChamado,
  type ServiceCallDetailed,
} from '@/services/client';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

type Filtro = 'todos' | 'andamento' | 'concluidos' | 'cancelados';

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'andamento', rotulo: 'Em andamento' },
  { chave: 'concluidos', rotulo: 'Concluídos' },
  { chave: 'cancelados', rotulo: 'Cancelados' },
];

function combinaComFiltro(call: ServiceCallDetailed, filtro: Filtro): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'concluidos') return call.status === 'finalizado';
  if (filtro === 'cancelados') return call.status === 'cancelado';
  return !['finalizado', 'cancelado'].includes(call.status);
}

export default function ChamadosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [calls, setCalls] = useState<ServiceCallDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const load = useCallback(async () => {
    setError(null);
    try {
      setCalls(await fetchMyServiceCalls());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar chamados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return calls.filter((c) => {
      if (!combinaComFiltro(c, filtro)) return false;
      if (!termo) return true;
      return (
        c.title.toLowerCase().includes(termo) ||
        String(c.code).includes(termo) ||
        (c.equipment ? equipmentName(c.equipment).toLowerCase().includes(termo) : false)
      );
    });
  }, [calls, busca, filtro]);

  const concluidos = useMemo(
    () => calls.filter((c) => c.status === 'finalizado').length,
    [calls],
  );

  return (
    <View style={styles.root}>
      <Header title="Histórico de serviços" eyebrow="Acompanhe seus atendimentos" />

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
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : calls.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nenhum chamado ainda"
              description="Quando precisar de atendimento, abra um chamado e acompanhe tudo por aqui."
              actionLabel="Abrir chamado"
              onAction={() => router.push('/chamado/novo')}
            />
          ) : (
            <>
              <View style={styles.busca}>
                <Search size={18} color={colors.textMuted} />
                <TextInput
                  value={busca}
                  onChangeText={setBusca}
                  placeholder="Pesquisar por serviço ou número…"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.brand}
                  style={styles.buscaInput}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtros}>
                {FILTROS.map((f) => {
                  const ativo = filtro === f.chave;
                  return (
                    <Pressable
                      key={f.chave}
                      onPress={() => setFiltro(f.chave)}
                      style={[styles.filtro, ativo ? styles.filtroAtivo : styles.filtroInativo]}>
                      <Text
                        variant="microLabel"
                        color={ativo ? colors.textOnBrand : colors.textSecondary}>
                        {f.rotulo}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Resumo do período, centralizado como no design. */}
              <View style={styles.resumo}>
                <View style={styles.resumoBloco}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Serviços registrados
                  </Text>
                  <Text variant="screenTitle">{calls.length}</Text>
                </View>
                <View style={styles.resumoFilete} />
                <View style={styles.resumoBloco}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Concluídos
                  </Text>
                  <Text variant="kpi" color={colors.brand}>
                    {concluidos}
                  </Text>
                </View>
              </View>

              <Button label="Abrir chamado" icon={Plus} onPress={() => router.push('/chamado/novo')} />

              {filtrados.length === 0 ? (
                <Card>
                  <Text variant="body" color={colors.textSecondary} style={styles.centro}>
                    Nenhum chamado encontrado com este filtro.
                  </Text>
                </Card>
              ) : (
                <CardGrid>
                  {filtrados.map((c) => {
                    const nota = notaDoChamado(c);
                    return (
                      <Card
                        key={c.id}
                        onPress={() => router.push(`/(cliente)/chamado/${c.id}` as never)}
                        padded="md">
                        <View style={styles.card}>
                          <View style={styles.cardTopo}>
                            <Badge
                              label={STATUS_LABEL[c.status]}
                              tone={STATUS_TONE[c.status]}
                              live={STATUS_LIVE.includes(c.status)}
                            />
                            <Text variant="meta" color={colors.textMuted}>
                              {formatDate(c.created_at)}
                            </Text>
                          </View>

                          {/* A nota só aparece quando o cliente avaliou. */}
                          {nota ? (
                            <View style={styles.estrelas}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  size={14}
                                  color={n <= nota ? colors.brand : colors.slate300}
                                  fill={n <= nota ? colors.brand : 'transparent'}
                                />
                              ))}
                            </View>
                          ) : null}

                          <Text variant="cardTitle" numberOfLines={1} style={styles.centro}>
                            {c.title}
                          </Text>

                          <View style={styles.local}>
                            <MapPin size={13} color={colors.brand} />
                            <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                              {c.address
                                ? `${c.address.street}${c.address.number ? `, ${c.address.number}` : ''}`
                                : c.equipment
                                  ? equipmentName(c.equipment)
                                  : `Chamado #${c.code}`}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </CardGrid>
              )}
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
    gap: spacing.md,
  },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  buscaInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },

  filtros: { gap: spacing.sm, paddingVertical: 2 },
  filtro: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filtroAtivo: { backgroundColor: colors.brand, borderColor: colors.brand },
  filtroInativo: { backgroundColor: colors.bgSurface, borderColor: colors.border },

  resumo: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  resumoBloco: { alignItems: 'center', gap: 2 },
  resumoFilete: { width: 64, height: 1, backgroundColor: colors.slate100 },

  card: { gap: spacing.sm, alignItems: 'center' },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  estrelas: { flexDirection: 'row', gap: 2 },
  local: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  centro: { textAlign: 'center' },
});
