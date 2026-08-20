import { useRouter } from 'expo-router';
import { Building2, ChevronRight, Mail, MessageCircle, Plus, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { fetchFornecedores, type Fornecedor } from '@/services/estoque';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

export default function FornecedoresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchFornecedores());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os fornecedores.');
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
      (f) =>
        f.name.toLowerCase().includes(termo) ||
        (f.trade_name ?? '').toLowerCase().includes(termo) ||
        (f.city ?? '').toLowerCase().includes(termo),
    );
  }, [itens, busca]);

  return (
    <View style={styles.root}>
      <Header
        title="Fornecedores"
        eyebrow="Estoque · Cadastro"
        onBack={() => router.back()}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Novo fornecedor"
            onPress={() => router.push('/(admin)/fornecedor/novo' as never)}
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
              placeholder="Pesquisar por nome ou cidade"
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
              icon={Building2}
              title={itens.length === 0 ? 'Nenhum fornecedor' : 'Nada encontrado'}
              description={
                itens.length === 0
                  ? 'Cadastre o primeiro fornecedor para poder enviar solicitações de cotação.'
                  : 'Tente outro termo de busca.'
              }
              actionLabel={itens.length === 0 ? 'Cadastrar fornecedor' : undefined}
              onAction={
                itens.length === 0
                  ? () => router.push('/(admin)/fornecedor/novo' as never)
                  : undefined
              }
            />
          ) : (
            filtrados.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/(admin)/fornecedor/${f.id}` as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                <View style={styles.itemIcone}>
                  <Building2 size={20} color={colors.brand} />
                </View>

                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {f.trade_name ?? f.name}
                  </Text>
                  <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                    {[f.contact_name, f.city && f.state ? `${f.city}/${f.state}` : f.city]
                      .filter(Boolean)
                      .join(' · ') || 'Sem contato informado'}
                  </Text>

                  <View style={styles.canais}>
                    {f.whatsapp ? (
                      <View style={styles.canal}>
                        <MessageCircle size={12} color={colors.successStrong} />
                        <Text variant="meta" color={colors.successStrong}>
                          WhatsApp
                        </Text>
                      </View>
                    ) : null}
                    {f.email ? (
                      <View style={styles.canal}>
                        <Mail size={12} color={colors.brand} />
                        <Text variant="meta" color={colors.brand}>
                          E-mail
                        </Text>
                      </View>
                    ) : null}
                    {!f.whatsapp && !f.email ? (
                      <Text variant="meta" color={colors.warningStrong}>
                        Sem canal de contato
                      </Text>
                    ) : null}
                  </View>
                </View>

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
  canais: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  canal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

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
