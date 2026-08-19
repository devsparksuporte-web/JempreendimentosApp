import { useRouter } from 'expo-router';
import {
  AirVent,
  Bell,
  CalendarClock,
  ChevronRight,
  HardHat,
  Plus,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { ListRow } from '@/components/ui/ListRow';
import { Section } from '@/components/ui/Section';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import {
  daysUntilLabel,
  equipmentName,
  firstName,
  formatDate,
  STATUS_LABEL,
  STATUS_LIVE,
  STATUS_TONE,
} from '@/lib/format';
import { fetchClienteHome, type ClienteHome } from '@/services/client';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export default function ClienteHomeScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<ClienteHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchClienteHome());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nome = firstName(profile?.full_name) || 'cliente';

  return (
    <View style={styles.root}>
      <Header
        title="JEmpreendimentos"
        eyebrow="Soluções Técnicas"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
            <Bell size={20} color={colors.textMuted} />
          </Pressable>
        }
      />

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
          <View style={styles.greeting}>
            <Text variant="microLabel" color={colors.textSecondary}>
              Cliente
            </Text>
            <Text variant="screenTitle">Olá, {nome}</Text>
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : !data?.client ? (
            <EmptyState
              icon={AirVent}
              title="Nenhum cadastro encontrado"
              description="Seu cadastro ainda está sendo preparado. Se o problema persistir, saia da conta e entre novamente ou fale com a equipe."
            />
          ) : (
            <>
              {data.activeCall ? (
                <Section label="Atendimento em andamento">
                  <Card
                    accentBorder={colors.brandSoft}
                    style={styles.activeCard}
                    onPress={() => router.push(`/chamado/${data.activeCall!.id}`)}>
                    <View style={styles.row}>
                      <IconTile icon={HardHat} size="md" />
                      <View style={styles.flex}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {data.activeCall.technician?.profile?.full_name ?? 'Técnico a definir'}
                        </Text>
                        <Badge
                          label={STATUS_LABEL[data.activeCall.status]}
                          tone={STATUS_TONE[data.activeCall.status]}
                          live={STATUS_LIVE.includes(data.activeCall.status)}
                        />
                      </View>
                      <ChevronRight size={20} color={colors.slate300} />
                    </View>
                  </Card>
                </Section>
              ) : null}

              <Section label="Seus equipamentos">
                {data.equipment.length === 0 ? (
                  <EmptyState
                    icon={AirVent}
                    title="Nenhum equipamento cadastrado"
                    description="Fale com a equipe para cadastrar seus aparelhos."
                  />
                ) : (
                  data.equipment.map((e) => (
                    <ListRow
                      key={e.id}
                      icon={AirVent}
                      title={equipmentName(e)}
                      subtitle={e.environment ?? undefined}
                      trailing={<Badge label="Em dia" tone="success" />}
                      onPress={() => router.push('/(cliente)/equipamentos')}
                    />
                  ))
                )}
              </Section>

              {data.nextMaintenance ? (
                <Section label="Próxima manutenção">
                  <Card>
                    <View style={styles.row}>
                      <IconTile icon={CalendarClock} />
                      <View style={styles.flex}>
                        <Text variant="kpi">{formatDate(data.nextMaintenance.next_due_at)}</Text>
                        <Text variant="meta" color={colors.textMuted}>
                          {daysUntilLabel(data.nextMaintenance.next_due_at)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Section>
              ) : null}

              <Button
                label="Abrir chamado"
                icon={Plus}
                onPress={() => router.push('/chamado/novo')}
              />

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
    gap: spacing.xl,
  },
  greeting: { gap: 2 },
  // O design destaca o atendimento em curso com fundo e borda da marca.
  activeCard: { backgroundColor: colors.brandTint },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  bell: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
