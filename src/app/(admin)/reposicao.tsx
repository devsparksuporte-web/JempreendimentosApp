import { useRouter } from 'expo-router';
import { Building2, ChevronRight, PackageCheck, PackageSearch, RefreshCw, ScanSearch } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  fetchReposicoes,
  ROTULO_STATUS,
  varrerEstoqueBaixo,
  type Reposicao,
  type StatusReposicao,
} from '@/services/estoque';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type Filtro = 'abertas' | 'todas' | 'concluidas';

/** Status que ainda pedem alguma ação de alguém. */
const ABERTAS: StatusReposicao[] = [
  'rascunho',
  'pendente',
  'enviado_fornecedor',
  'fornecedor_respondeu',
  'em_analise',
  'aprovado',
  'comprado',
  'recebido',
];

const TOM_STATUS: Record<StatusReposicao, BadgeTone> = {
  rascunho: 'neutral',
  pendente: 'warning',
  enviado_fornecedor: 'info',
  fornecedor_respondeu: 'info',
  em_analise: 'info',
  aprovado: 'success',
  comprado: 'success',
  recebido: 'success',
  concluido: 'success',
  cancelado: 'neutral',
  recusado: 'danger',
};

const TOM_PRIORIDADE: Record<Reposicao['priority'], BadgeTone> = {
  baixa: 'neutral',
  normal: 'info',
  alta: 'warning',
  urgente: 'danger',
};

export default function ReposicaoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Reposicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [varrendo, setVarrendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abertas');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchReposicoes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as solicitações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * O gatilho do banco só dispara na travessia do mínimo. Produto que já
   * estava baixo antes dele existir nunca foi visto — esta varredura é o que
   * põe esses casos em dia.
   */
  async function varrer() {
    setVarrendo(true);
    try {
      const criadas = await varrerEstoqueBaixo();
      await load();
      Alert.alert(
        'Varredura concluída',
        criadas > 0
          ? `${criadas} solicitação(ões) criada(s).`
          : 'Nenhuma solicitação nova. Produtos baixos sem estoque máximo configurado não geram sugestão.',
      );
    } catch (e) {
      Alert.alert('Não foi possível varrer', e instanceof Error ? e.message : '');
    } finally {
      setVarrendo(false);
    }
  }

  const filtradas = useMemo(() => {
    if (filtro === 'todas') return itens;
    if (filtro === 'abertas') return itens.filter((i) => ABERTAS.includes(i.status));
    return itens.filter((i) => !ABERTAS.includes(i.status));
  }, [itens, filtro]);

  const abertas = useMemo(() => itens.filter((i) => ABERTAS.includes(i.status)).length, [itens]);

  return (
    <View style={styles.root}>
      <Header
        title="Reposição de estoque"
        eyebrow="Solicitações e fornecedores"
        onBack={() => router.back()}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar"
            onPress={load}
            style={styles.icone}>
            <RefreshCw size={18} color={colors.brand} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={styles.container}>
          <Card style={abertas > 0 ? styles.resumoAtivo : undefined}>
            <View style={styles.resumo}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>
                  Aguardando alguma ação
                </Text>
                <Text variant="kpi" color={abertas > 0 ? colors.warningStrong : colors.textPrimary}>
                  {abertas}
                </Text>
              </View>
              <PackageSearch size={30} color={colors.brand} />
            </View>
            <Button
              label="Procurar estoque baixo agora"
              icon={ScanSearch}
              variant="secondary"
              loading={varrendo}
              onPress={() => {
                void varrer();
              }}
            />
            <View style={styles.espaco} />
            <Button
              label="Recebimento de mercadoria"
              icon={PackageCheck}
              variant="secondary"
              onPress={() => router.push('/(admin)/recebimento' as never)}
            />
            <View style={styles.espaco} />
            <Button
              label="Fornecedores"
              icon={Building2}
              variant="secondary"
              onPress={() => router.push('/(admin)/fornecedores' as never)}
            />
          </Card>

          <View style={styles.filtros}>
            {(
              [
                ['abertas', 'Em aberto'],
                ['concluidas', 'Encerradas'],
                ['todas', 'Todas'],
              ] as [Filtro, string][]
            ).map(([chave, rotulo]) => {
              const ativo = filtro === chave;
              return (
                <Pressable
                  key={chave}
                  onPress={() => setFiltro(chave)}
                  style={[styles.filtro, ativo ? styles.filtroAtivo : styles.filtroInativo]}>
                  <Text variant="meta" color={ativo ? colors.textOnBrand : colors.textSecondary}>
                    {rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtradas.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Nenhuma solicitação"
              description="Quando um produto cruzar o estoque mínimo, a solicitação aparece aqui. Produtos sem estoque máximo configurado não geram sugestão."
            />
          ) : (
            filtradas.map((r) => {
              const quantidade = r.quantity_requested ?? r.quantity_suggested;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push(`/(admin)/reposicao/${r.id}` as never)}
                  style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                  <View style={styles.flex}>
                    <View style={styles.itemTopo}>
                      <Text variant="bodyStrong">{r.number}</Text>
                      <Badge label={ROTULO_STATUS[r.status]} tone={TOM_STATUS[r.status]} />
                      {r.priority === 'urgente' || r.priority === 'alta' ? (
                        <Badge label={r.priority} tone={TOM_PRIORIDADE[r.priority]} />
                      ) : null}
                    </View>

                    <Text variant="cardTitle" numberOfLines={1}>
                      {r.part?.name ?? 'Produto'}
                    </Text>

                    <Text variant="meta" color={colors.textSecondary}>
                      {quantidade} {r.part?.unit ?? 'un'} · saldo {r.quantity_current} · mínimo{' '}
                      {r.min_quantity}
                    </Text>

                    <Text variant="meta" color={colors.textMuted}>
                      {r.supplier?.name ?? 'Sem fornecedor definido'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.slate300} />
                </Pressable>
              );
            })
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
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  flex: { flex: 1, gap: spacing.xs },

  resumo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  resumoAtivo: { borderColor: colors.warningSoft },
  espaco: { height: spacing.sm },

  filtros: { flexDirection: 'row', gap: spacing.sm },
  filtro: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filtroAtivo: { backgroundColor: colors.brand, borderColor: colors.brand },
  filtroInativo: { backgroundColor: colors.bgSurface, borderColor: colors.border },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },

  icone: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.85, transform: [{ scale: 0.995 }] },
});
