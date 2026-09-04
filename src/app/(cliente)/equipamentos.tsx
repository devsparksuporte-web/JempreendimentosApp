import { AirVent, Snowflake } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { comparavel, Filtros } from '@/components/Filtros';
import { Tabela, type Coluna } from '@/components/Tabela';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { equipmentName, formatDate } from '@/lib/format';
import { fetchClienteHome } from '@/services/client';
import { colors, layout, spacing } from '@/theme/tokens';
import type { Equipment } from '@/types/database';

export default function EquipamentosScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchClienteHome();
      setItems(data.equipment);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar equipamentos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtrados = useMemo(() => {
    const alvo = comparavel(texto);
    if (!alvo) return items;
    return items.filter((e) =>
      comparavel(
        [e.brand, e.model, e.environment, e.serial_number, e.technology].filter(Boolean).join(' '),
      ).includes(alvo),
    );
  }, [items, texto]);

  const colunas: Coluna<Equipment>[] = [
    {
      titulo: 'Aparelho',
      peso: 2,
      celula: (e) => (
        <Text variant="bodyStrong" numberOfLines={1}>
          {equipmentName(e)}
        </Text>
      ),
    },
    {
      titulo: 'Ambiente',
      peso: 1.4,
      celula: (e) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {e.environment ?? 'Não informado'}
        </Text>
      ),
    },
    {
      titulo: 'Nº de série',
      peso: 1.2,
      celula: (e) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {e.serial_number ?? '—'}
        </Text>
      ),
    },
    {
      titulo: 'Gás',
      largura: 90,
      celula: (e) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {e.gas_type ?? '—'}
        </Text>
      ),
    },
    {
      titulo: 'Instalado',
      largura: 100,
      celula: (e) => (
        <Text variant="meta" color={colors.textMuted}>
          {formatDate(e.installed_at)}
        </Text>
      ),
    },
    {
      titulo: 'Garantia',
      largura: 100,
      celula: (e) => (
        <Text variant="meta" color={colors.textMuted}>
          {formatDate(e.warranty_until)}
        </Text>
      ),
    },
    {
      titulo: 'Situação',
      largura: 92,
      aoDireita: true,
      celula: () => <Badge label="Em dia" tone="success" />,
    },
  ];

  return (
    <View style={styles.root}>
      <Header title="Equipamentos" />
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
          {!loading && !error && items.length > 0 ? (
            <Filtros
              busca={{
                valor: texto,
                aoDigitar: setTexto,
                dica: 'Filtrar por marca, ambiente ou série',
              }}
            />
          ) : null}

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={AirVent}
              title={texto ? 'Nada encontrado' : 'Nenhum equipamento cadastrado'}
              description={
                texto
                  ? `Nenhum aparelho seu combina com “${texto}”.`
                  : 'Assim que a equipe cadastrar seus aparelhos, eles aparecem aqui com todo o histórico.'
              }
            />
          ) : (
            <Tabela
              itens={filtrados}
              colunas={colunas}
              chave={(e) => e.id}
              emColunas
              cartao={(e) => (
              <Card key={e.id}>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <IconTile icon={AirVent} />
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{equipmentName(e)}</Text>
                      <Text variant="meta" color={colors.textSecondary}>
                        {e.environment ?? 'Ambiente não informado'}
                      </Text>
                    </View>
                    <Badge label="Em dia" tone="success" />
                  </View>

                  <View style={styles.specs}>
                    <Spec rotulo="Modelo" valor={e.model ?? '—'} />
                    <Spec rotulo="Nº de série" valor={e.serial_number ?? '—'} />
                    <Spec rotulo="Gás" valor={e.gas_type ?? '—'} />
                    <Spec rotulo="Tecnologia" valor={e.technology ?? '—'} />
                    <Spec rotulo="Instalado em" valor={formatDate(e.installed_at)} />
                    <Spec rotulo="Garantia até" valor={formatDate(e.warranty_until)} />
                  </View>
                </View>
              </Card>
              )}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Spec({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.spec}>
      <View style={styles.specIcon}>
        <Snowflake size={12} color={colors.textMuted} />
      </View>
      <Text variant="meta" color={colors.textSecondary} style={styles.flex}>
        {rotulo}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {valor}
      </Text>
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
    gap: spacing.lg,
  },
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  specs: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  spec: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  specIcon: { width: 16, alignItems: 'center' },
});
