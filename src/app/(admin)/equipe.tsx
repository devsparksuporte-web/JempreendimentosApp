import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, HardHat, RefreshCw, UserPlus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  fetchTecnicos,
  ROTULO_ESPECIALIDADE,
  ROTULO_STATUS_TECNICO,
  type Tecnico,
} from '@/services/cadastros';
import { colors, layout, radius, spacing } from '@/theme/tokens';

const TOM_STATUS: Record<Tecnico['status'], BadgeTone> = {
  disponivel: 'success',
  em_atendimento: 'info',
  a_caminho: 'warning',
  indisponivel: 'neutral',
};

export default function EquipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchTecnicos());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a equipe.');
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

  const ativos = useMemo(() => itens.filter((t) => t.active).length, [itens]);

  return (
    <View style={styles.root}>
      <Header
        title="Equipe técnica"
        eyebrow="Cadastro e vínculos"
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
          <Card>
            <View style={styles.resumo}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>
                  Técnicos ativos
                </Text>
                <Text variant="kpi">{ativos}</Text>
              </View>
              <HardHat size={30} color={colors.brand} />
            </View>
            <Button
              label="Vincular técnico"
              icon={UserPlus}
              onPress={() => router.push('/(admin)/tecnico/novo' as never)}
            />
            <View style={styles.espaco} />
            <Text variant="meta" color={colors.textMuted}>
              O vínculo é feito sobre uma conta que já existe. A pessoa se cadastra no aplicativo e
              você a liga à equipe aqui — criar login por esta tela exigiria a chave de serviço do
              Supabase dentro do app, que é justamente o que não se faz.
            </Text>
          </Card>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : itens.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="Nenhum técnico vinculado"
              description="Peça para a pessoa criar a conta no aplicativo e depois use Vincular técnico."
            />
          ) : (
            itens.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/(admin)/tecnico/${t.id}` as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                <View style={styles.flex}>
                  <View style={styles.itemTopo}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {t.profile?.full_name || 'Sem nome'}
                    </Text>
                    <Badge label={ROTULO_STATUS_TECNICO[t.status]} tone={TOM_STATUS[t.status]} />
                    {!t.active ? <Badge label="Inativo" tone="neutral" /> : null}
                  </View>

                  <Text variant="meta" color={colors.textSecondary}>
                    {t.registration ? `Matrícula ${t.registration}` : 'Sem matrícula'}
                    {t.profile?.email ? ` · ${t.profile.email}` : ''}
                  </Text>

                  <Text variant="meta" color={colors.textMuted} numberOfLines={1}>
                    {t.specialties.length > 0
                      ? t.specialties.map((e) => ROTULO_ESPECIALIDADE[e] ?? e).join(' · ')
                      : 'Sem especialidade informada'}
                  </Text>
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
  flex: { flex: 1, gap: spacing.xs },

  resumo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  espaco: { height: spacing.sm },

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
