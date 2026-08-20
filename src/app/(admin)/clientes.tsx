import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Search, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { fetchClientes, type Cliente } from '@/services/cadastros';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

export default function ClientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchClientes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter(
      (c) =>
        c.name.toLowerCase().includes(termo) ||
        (c.doc ?? '').includes(termo) ||
        (c.phone ?? '').includes(termo),
    );
  }, [itens, busca]);

  return (
    <View style={styles.root}>
      <Header
        title="Clientes"
        eyebrow="Cadastro"
        onBack={() => router.back()}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Novo cliente"
            onPress={() => router.push('/(admin)/cliente/novo' as never)}
            style={styles.icone}>
            <Plus size={18} color={colors.brand} />
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
          <View style={styles.busca}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Pesquisar por nome, documento ou telefone"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              style={styles.buscaInput}
            />
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={itens.length === 0 ? 'Nenhum cliente' : 'Nada encontrado'}
              description={
                itens.length === 0
                  ? 'Cadastre o primeiro cliente para poder registrar equipamentos e abrir chamados.'
                  : 'Tente outro termo de busca.'
              }
              actionLabel={itens.length === 0 ? 'Cadastrar cliente' : undefined}
              onAction={
                itens.length === 0 ? () => router.push('/(admin)/cliente/novo' as never) : undefined
              }
            />
          ) : (
            filtrados.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(admin)/cliente/${c.id}` as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                <View style={styles.itemIcone}>
                  <UserRound size={20} color={colors.brand} />
                </View>

                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                    {[c.doc, c.phone ?? c.whatsapp].filter(Boolean).join(' · ') ||
                      'Sem documento nem telefone'}
                  </Text>
                </View>

                {!c.active ? <Badge label="Inativo" tone="neutral" /> : null}
                {c.profile_id ? <Badge label="Tem acesso" tone="success" /> : null}
                <ChevronRight size={18} color={colors.slate300} />
              </Pressable>
            ))
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
  itemIcone: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
