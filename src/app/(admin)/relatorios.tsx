import { ArrowUpRight, BarChart3, Clock, RefreshCw, Star, TrendingDown } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  fetchRelatorio,
  formatarDuracaoMin,
  type Periodo,
  type Relatorio,
} from '@/services/relatorios';
import { colors, layout, radius, spacing } from '@/theme/tokens';

const PERIODOS: { chave: Periodo; rotulo: string }[] = [
  { chave: 'mes', rotulo: 'Mês' },
  { chave: 'ano', rotulo: 'Ano' },
];

/** Altura máxima das barras do gráfico, em pontos. */
const ALTURA_GRAFICO = 160;

export default function AdminRelatoriosScreen() {
  const insets = useSafeAreaInsets();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [dados, setDados] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDados(await fetchRelatorio(periodo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível montar o relatório.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const maior = dados ? Math.max(1, ...dados.serie.map((p) => p.valor)) : 1;

  return (
    <View style={styles.root}>
      <Header
        title="Relatórios"
        eyebrow="Performance e analytics"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar"
            onPress={load}
            style={styles.refresh}>
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
              load();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={styles.container}>
          {/* Seletor de período, no formato segmentado do design. */}
          <View style={styles.segmentado}>
            {PERIODOS.map((p) => {
              const ativo = periodo === p.chave;
              return (
                <Pressable
                  key={p.chave}
                  onPress={() => setPeriodo(p.chave)}
                  style={[styles.segmento, ativo && styles.segmentoAtivo]}>
                  <Text
                    variant="microLabel"
                    color={ativo ? colors.textOnBrand : colors.textSecondary}>
                    {p.rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <LoadingState label="Consolidando os atendimentos…" />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : dados ? (
            <View style={styles.cartao}>
              <View style={styles.cartaoTopo}>
                <View style={styles.iconeGrande}>
                  <BarChart3 size={34} color={colors.brand} />
                </View>
                <Text variant="screenTitle" style={styles.caixaAlta}>
                  Resumo analítico
                </Text>
                <Text variant="body" color={colors.textSecondary}>
                  Consolidado de operações técnicas
                </Text>
              </View>

              <View style={styles.bloco}>
                <View style={styles.blocoTitulo}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Serviços concluídos
                  </Text>
                  <Text variant="kpi">{dados.concluidos}</Text>

                  {/* A variação só aparece quando existe período anterior
                      com que comparar — sem base, um "+0%" seria mentira. */}
                  {dados.variacao !== null ? (
                    <View
                      style={[
                        styles.variacao,
                        {
                          backgroundColor:
                            dados.variacao >= 0 ? colors.successSoft : colors.dangerSoft,
                        },
                      ]}>
                      {dados.variacao >= 0 ? (
                        <ArrowUpRight size={14} color={colors.successStrong} />
                      ) : (
                        <TrendingDown size={14} color={colors.dangerStrong} />
                      )}
                      <Text
                        variant="meta"
                        color={dados.variacao >= 0 ? colors.successStrong : colors.dangerStrong}>
                        {dados.variacao >= 0 ? '+' : ''}
                        {dados.variacao}% vs. período anterior
                      </Text>
                    </View>
                  ) : (
                    <Text variant="meta" color={colors.textMuted}>
                      Sem período anterior para comparar
                    </Text>
                  )}
                </View>

                <View style={styles.grafico}>
                  {dados.serie.map((ponto, i) => {
                    const ultimo = i === dados.serie.length - 1;
                    const altura = Math.max(6, (ponto.valor / maior) * ALTURA_GRAFICO);
                    return (
                      <View key={`${ponto.rotulo}-${i}`} style={styles.colunaGrafico}>
                        <View
                          style={[
                            styles.barra,
                            { height: altura },
                            ultimo && styles.barraAtual,
                          ]}
                        />
                        <Text
                          variant="meta"
                          color={ultimo ? colors.brand : colors.textMuted}>
                          {ponto.rotulo}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text variant="meta" color={colors.textMuted} style={styles.centro}>
                  Relatório gerado a partir dos atendimentos finalizados
                </Text>
              </View>

              <View style={styles.filete} />

              <View style={styles.indicadores}>
                <View style={styles.indicador}>
                  <View style={styles.indicadorTopo}>
                    <Star size={16} color={colors.brand} fill={colors.brand} />
                    <Text variant="microLabel" color={colors.textSecondary}>
                      Nota média
                    </Text>
                  </View>
                  <Text variant="kpi">
                    {dados.notaMedia !== null ? dados.notaMedia.toFixed(1) : '—'}
                  </Text>
                  <Text variant="meta" color={colors.textMuted}>
                    {dados.totalAvaliacoes > 0
                      ? `${dados.totalAvaliacoes} avaliação(ões)`
                      : 'Ninguém avaliou ainda'}
                  </Text>
                </View>

                <View style={styles.indicadorFilete} />

                <View style={styles.indicador}>
                  <View style={styles.indicadorTopo}>
                    <Clock size={16} color={colors.brand} />
                    <Text variant="microLabel" color={colors.textSecondary}>
                      Tempo médio
                    </Text>
                  </View>
                  <Text variant="kpi">{formatarDuracaoMin(dados.duracaoMediaMin)}</Text>
                  <Text variant="meta" color={colors.textMuted}>
                    Do início à conclusão
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
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
    gap: spacing.lg,
  },
  centro: { textAlign: 'center' },
  caixaAlta: { textTransform: 'uppercase' },

  segmentado: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 4,
  },
  segmento: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  segmentoAtivo: { backgroundColor: colors.brand },

  cartao: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 32,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  cartaoTopo: { alignItems: 'center', gap: spacing.sm },
  iconeGrande: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bloco: { gap: spacing.lg },
  blocoTitulo: { alignItems: 'center', gap: spacing.xs },
  variacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },

  grafico: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: ALTURA_GRAFICO + 24,
  },
  colunaGrafico: { flex: 1, alignItems: 'center', gap: spacing.sm },
  barra: {
    width: '100%',
    backgroundColor: colors.slate100,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  barraAtual: { backgroundColor: colors.brand },

  filete: { height: 1, backgroundColor: colors.slate100 },

  indicadores: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  indicador: { flex: 1, alignItems: 'center', gap: spacing.xs },
  indicadorTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  indicadorFilete: { width: 1, height: 56, backgroundColor: colors.slate100 },

  refresh: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
