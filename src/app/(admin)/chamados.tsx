import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, ClipboardList, RefreshCw } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { comparavel, Filtros } from '@/components/Filtros';
import { Tabela, type Coluna } from '@/components/Tabela';
import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatDate, formatTime, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { fetchChamados, STATUS_ABERTOS, type AdminCall } from '@/services/admin';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type Filtro = 'abertos' | 'encerrados' | 'todos';

export default function ChamadosAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<AdminCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [texto, setTexto] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchChamados());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os chamados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtrados = useMemo(() => {
    const aberto = (c: AdminCall) => STATUS_ABERTOS.includes(c.status);
    const porStatus =
      filtro === 'todos'
        ? itens
        : itens.filter((c) => (filtro === 'abertos' ? aberto(c) : !aberto(c)));

    const alvo = comparavel(texto);
    if (!alvo) return porStatus;
    // Procura no que a pessoa lê na tela: número, cliente, aparelho e técnico.
    return porStatus.filter((c) =>
      comparavel(
        [
          c.code,
          c.title,
          c.client?.name,
          c.equipment?.brand,
          c.equipment?.model,
          c.equipment?.environment,
          c.technician?.profile?.full_name,
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(alvo),
    );
  }, [itens, filtro, texto]);

  const colunas: Coluna<AdminCall>[] = [
    {
      titulo: 'Código',
      largura: 78,
      celula: (c) => <Text variant="bodyStrong">#{c.code}</Text>,
    },
    {
      titulo: 'Cliente',
      peso: 2,
      celula: (c) => (
        <Text variant="body" numberOfLines={1}>
          {c.client?.name ?? 'Cliente'}
        </Text>
      ),
    },
    {
      titulo: 'Equipamento',
      peso: 2,
      celula: (c) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {[c.equipment?.brand, c.equipment?.model].filter(Boolean).join(' ') || 'Sem equipamento'}
          {c.equipment?.environment ? ` · ${c.equipment.environment}` : ''}
        </Text>
      ),
    },
    {
      titulo: 'Técnico',
      peso: 1.4,
      celula: (c) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {c.technician?.profile?.full_name ?? 'Sem técnico'}
        </Text>
      ),
    },
    {
      titulo: 'Abertura',
      largura: 132,
      celula: (c) => (
        <Text variant="meta" color={colors.textMuted} numberOfLines={1}>
          {`${formatDate(c.created_at)} ${formatTime(c.created_at)}`}
        </Text>
      ),
    },
    {
      titulo: 'Situação',
      largura: 132,
      aoDireita: true,
      celula: (c) => <Badge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} />,
    },
  ];

  return (
    <View style={styles.root}>
      <Header
        title="Chamados"
        eyebrow="Histórico completo"
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
          <Filtros
            valor={filtro}
            aoTrocar={setFiltro}
            opcoes={[
              { chave: 'abertos', rotulo: 'Em aberto' },
              { chave: 'encerrados', rotulo: 'Encerrados' },
              { chave: 'todos', rotulo: 'Todos' },
            ]}
            busca={{
              valor: texto,
              aoDigitar: setTexto,
              dica: 'Filtrar por cliente, aparelho ou nº',
            }}
          />

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={texto ? 'Nada encontrado' : 'Nenhum chamado'}
              description={
                texto
                  ? `Nenhum chamado deste recorte combina com “${texto}”.`
                  : 'Chamado encerrado continua aqui: é onde se consulta o laudo e a conversa depois que o serviço acabou.'
              }
            />
          ) : (
            <Tabela
              itens={filtrados}
              colunas={colunas}
              chave={(c) => c.id}
              aoAbrir={(c) => router.push(`/(admin)/chamado/${c.id}` as never)}
              cartao={(c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(admin)/chamado/${c.id}` as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                <View style={styles.flex}>
                  <View style={styles.itemTopo}>
                    <Text variant="bodyStrong">#{c.code}</Text>
                    <Badge label={STATUS_LABEL[c.status]} tone={STATUS_TONE[c.status]} />
                  </View>

                  <Text variant="cardTitle" numberOfLines={1}>
                    {c.client?.name ?? 'Cliente'}
                  </Text>

                  <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                    {[c.equipment?.brand, c.equipment?.model].filter(Boolean).join(' ') ||
                      'Sem equipamento'}
                    {c.equipment?.environment ? ` · ${c.equipment.environment}` : ''}
                  </Text>

                  <Text variant="meta" color={colors.textMuted}>
                    {`${formatDate(c.created_at)} ${formatTime(c.created_at)}`}
                    {c.technician?.profile?.full_name
                      ? ` · ${c.technician.profile.full_name}`
                      : ' · sem técnico'}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.slate300} />
              </Pressable>
              )}
            />
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
