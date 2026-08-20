import { AlertCircle, Box, Package, Plus, RefreshCw, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { fetchInventory, type InventoryRow } from '@/services/operations';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

/** Três faixas de saldo, cada uma com sua cor e seu recado. */
function nivelDoItem(row: InventoryRow) {
  const saldo = Number(row.quantity);
  const minimo = Number(row.min_quantity);

  if (saldo <= 0 || (minimo > 0 && saldo <= minimo / 2)) {
    return {
      chave: 'critico' as const,
      rotulo: 'Nível crítico',
      borda: colors.dangerSoft,
      fundo: colors.dangerSoft,
      texto: colors.dangerStrong,
      icone: AlertCircle,
    };
  }
  if (saldo <= minimo) {
    return {
      chave: 'baixo' as const,
      rotulo: 'Solicitar reposição',
      borda: colors.warningSoft,
      fundo: colors.warningSoft,
      texto: colors.warningStrong,
      icone: Package,
    };
  }
  return {
    chave: 'ok' as const,
    rotulo: 'Estoque OK',
    borda: colors.border,
    fundo: colors.slate50,
    texto: colors.successStrong,
    icone: Box,
  };
}

export default function AdminInventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchInventory());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o estoque.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alertas = useMemo(
    () => rows.filter((r) => nivelDoItem(r).chave !== 'ok').length,
    [rows],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter(
      (r) =>
        (r.part?.name ?? '').toLowerCase().includes(termo) ||
        (r.part?.sku ?? '').toLowerCase().includes(termo),
    );
  }, [rows, busca]);

  return (
    <View style={styles.root}>
      <Header
        title="Gerenciamento de estoque"
        eyebrow="Controle de peças e componentes"
        trailing={
          <View style={styles.headerAcoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Novo produto"
              onPress={() => router.push('/(admin)/produto/novo' as never)}
              style={styles.refresh}>
              <Plus size={18} color={colors.brand} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Atualizar"
              onPress={load}
              style={styles.refresh}>
              <RefreshCw size={18} color={colors.brand} />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.busca}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Pesquisar por SKU ou nome da peça"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              style={styles.buscaInput}
            />
          </View>

          {/* Os dois números que o design põe no topo. */}
          <View style={styles.metricas}>
            <View style={styles.metrica}>
              <Text variant="microLabel" color={colors.textSecondary}>
                Total de itens
              </Text>
              <Text variant="kpi">{rows.length}</Text>
              <View style={[styles.selo, { backgroundColor: colors.brandTint, borderColor: colors.brandSoft }]}>
                <Text variant="meta" color={colors.brandStrong}>
                  Status: normal
                </Text>
              </View>
            </View>

            <View style={[styles.metrica, alertas > 0 && styles.metricaAlerta]}>
              <Text variant="microLabel" color={colors.textSecondary}>
                Alertas baixos
              </Text>
              <Text variant="kpi" color={alertas > 0 ? colors.warningStrong : colors.textPrimary}>
                {String(alertas).padStart(2, '0')}
              </Text>
              <View
                style={[
                  styles.selo,
                  {
                    backgroundColor: alertas > 0 ? colors.warningSoft : colors.successSoft,
                    borderColor: alertas > 0 ? colors.warningSoft : colors.successSoft,
                  },
                ]}>
                <Text
                  variant="meta"
                  color={alertas > 0 ? colors.warningStrong : colors.successStrong}>
                  {alertas > 0 ? 'Ação necessária' : 'Tudo em dia'}
                </Text>
              </View>
            </View>
          </View>

          {/* Faixa azul de aviso — só quando há o que avisar. */}
          {alertas > 0 ? (
            <View style={styles.aviso}>
              <View style={styles.avisoIcone}>
                <AlertCircle size={22} color={colors.textOnBrand} />
              </View>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textOnBrand}>
                  Notificação do sistema
                </Text>
                <Text variant="meta" color={colors.brandTint}>
                  {alertas} peça(s) abaixo do mínimo. Avalie a reposição antes das próximas
                  ordens de serviço.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.tituloSecao}>
            <Text variant="microLabel" color={colors.textSecondary}>
              Peças em estoque
            </Text>
            <View style={styles.tituloTraco} />
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtrados.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary} style={styles.centro}>
                Nenhuma peça encontrada.
              </Text>
            </Card>
          ) : (
            filtrados.map((row) => {
              const nivel = nivelDoItem(row);
              const Icone = nivel.icone;
              return (
                <Pressable
                  key={row.part_id}
                  onPress={() => router.push(`/(admin)/produto/${row.part_id}` as never)}
                  style={({ pressed }) => [
                    styles.item,
                    { borderColor: nivel.borda },
                    pressed && styles.itemPressionado,
                  ]}>
                  <View style={[styles.itemIcone, { backgroundColor: nivel.fundo }]}>
                    <Icone size={22} color={nivel.chave === 'ok' ? colors.brand : nivel.texto} />
                  </View>

                  <View style={styles.flex}>
                    <View style={styles.itemTopo}>
                      <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                        {row.part?.name ?? 'Peça sem nome'}
                      </Text>
                      <View style={[styles.quantidade, { backgroundColor: nivel.fundo }]}>
                        <Text variant="meta" color={nivel.chave === 'ok' ? colors.brandStrong : nivel.texto}>
                          {String(row.quantity)} {row.part?.unit ?? 'un'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.itemMeta}>
                      {row.part?.sku ? (
                        <>
                          <Text variant="meta" color={colors.textMuted}>
                            SKU: {row.part.sku}
                          </Text>
                          <View style={styles.pontinho} />
                        </>
                      ) : null}
                      <Text variant="meta" color={nivel.texto}>
                        {nivel.rotulo}
                      </Text>
                    </View>
                  </View>
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
  flex: { flex: 1, gap: 2 },
  centro: { textAlign: 'center' },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  buscaInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },

  metricas: { flexDirection: 'row', gap: spacing.md },
  metrica: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricaAlerta: { borderColor: colors.warningSoft },
  selo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  avisoIcone: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tituloSecao: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  tituloTraco: { width: 32, height: 4, borderRadius: radius.pill, backgroundColor: colors.brand },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  itemIcone: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quantidade: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  pontinho: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.slate300 },

  headerAcoes: { flexDirection: 'row', gap: spacing.sm },
  itemPressionado: { opacity: 0.85, transform: [{ scale: 0.995 }] },
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
