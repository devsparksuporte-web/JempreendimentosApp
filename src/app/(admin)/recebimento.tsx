import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, PackageCheck, RefreshCw, Truck } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  fetchPedidos,
  PEDIDOS_ABERTOS,
  quantidadePedida,
  quantidadeRecebida,
  ROTULO_PEDIDO,
  type Pedido,
  type StatusPedido,
} from '@/services/compras';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type Filtro = 'aguardando' | 'encerrados' | 'todos';

const TOM_PEDIDO: Record<StatusPedido, BadgeTone> = {
  criado: 'warning',
  enviado: 'info',
  confirmado: 'info',
  em_transito: 'warning',
  recebido: 'success',
  cancelado: 'neutral',
};

/** Data curta, do jeito que se lê numa nota. */
function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}

export default function RecebimentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('aguardando');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchPedidos());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // A tela fica montada dentro das abas. Sem recarregar ao voltar, quem
  // acabou de aprovar uma cotação não encontra o pedido aqui.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return itens;
    const aberto = (p: Pedido) => PEDIDOS_ABERTOS.includes(p.status);
    return itens.filter((p) => (filtro === 'aguardando' ? aberto(p) : !aberto(p)));
  }, [itens, filtro]);

  const aguardando = useMemo(
    () => itens.filter((p) => PEDIDOS_ABERTOS.includes(p.status)).length,
    [itens],
  );

  return (
    <View style={styles.root}>
      <Header
        title="Recebimento de mercadoria"
        eyebrow="Pedidos de compra"
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
          <Card style={aguardando > 0 ? styles.resumoAtivo : undefined}>
            <View style={styles.resumo}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>
                  Pedidos esperando mercadoria
                </Text>
                <Text
                  variant="kpi"
                  color={aguardando > 0 ? colors.warningStrong : colors.textPrimary}>
                  {aguardando}
                </Text>
              </View>
              <Truck size={30} color={colors.brand} />
            </View>
            <Text variant="meta" color={colors.textMuted}>
              O estoque só sobe quando a entrada é confirmada aqui. Enquanto isso, o pedido continua
              em aberto para cobrança do fornecedor.
            </Text>
          </Card>

          <View style={styles.filtros}>
            {(
              [
                ['aguardando', 'Aguardando'],
                ['encerrados', 'Encerrados'],
                ['todos', 'Todos'],
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
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="Nenhum pedido"
              description="O pedido de compra nasce da aprovação de uma cotação na tela de reposição. Aprovada a cotação, ele aparece aqui para receber."
            />
          ) : (
            filtrados.map((p) => {
              const pedida = quantidadePedida(p);
              const recebida = quantidadeRecebida(p);
              const unidade = p.request?.part?.unit ?? 'un';
              const previsao = dataCurta(p.expected_delivery);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/(admin)/recebimento/${p.id}` as never)}
                  style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                  <View style={styles.flex}>
                    <View style={styles.itemTopo}>
                      <Text variant="bodyStrong">{p.number}</Text>
                      <Badge label={ROTULO_PEDIDO[p.status]} tone={TOM_PEDIDO[p.status]} />
                      {recebida > 0 && recebida < pedida ? (
                        <Badge label="Parcial" tone="warning" />
                      ) : null}
                    </View>

                    <Text variant="cardTitle" numberOfLines={1}>
                      {p.request?.part?.name ?? 'Produto'}
                    </Text>

                    <Text variant="meta" color={colors.textSecondary}>
                      {recebida} de {pedida} {unidade} recebidas
                    </Text>

                    <Text variant="meta" color={colors.textMuted}>
                      {p.supplier?.name ?? 'Fornecedor'}
                      {previsao ? ` · previsto para ${previsao}` : ''}
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
