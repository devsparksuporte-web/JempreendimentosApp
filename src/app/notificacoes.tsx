import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  MessageSquare,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { decrementarNaoLidas, recarregarNaoLidas, zerarNaoLidas } from '@/lib/naoLidas';
import {
  destinoDaNotificacao,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type AppNotification,
  type NotificationCategory,
} from '@/services/notifications';
import { colors, elevation, layout, radius, spacing } from '@/theme/tokens';

type Filtro = 'todas' | 'nao_lidas' | NotificationCategory;

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'nao_lidas', rotulo: 'Não lidas' },
  { chave: 'chamados', rotulo: 'Chamados' },
  { chave: 'estoque', rotulo: 'Estoque' },
  { chave: 'servicos', rotulo: 'Serviços' },
  { chave: 'mensagens', rotulo: 'Mensagens' },
  { chave: 'financeiro', rotulo: 'Financeiro' },
];

const ICONE_CATEGORIA: Record<string, typeof Bell> = {
  chamados: ClipboardList,
  estoque: Boxes,
  servicos: Wrench,
  mensagens: MessageSquare,
  financeiro: Wallet,
  agenda: CalendarClock,
  equipe: Users,
};

const ICONE_TOM = {
  info: ClipboardList,
  success: CheckCircle2,
  warning: Clock3,
  danger: AlertCircle,
} as const;

function corDaNotificacao(n: AppNotification): string {
  if (n.priority === 'urgent') return colors.dangerStrong;
  if (n.priority === 'high') return colors.warningStrong;
  if (n.kind === 'success') return colors.success;
  return colors.brand;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchNotifications());
      await recarregarNaoLidas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A central é o lugar onde a chegada em tempo real mais importa: quem está
  // com ela aberta espera ver a notificação aparecer sozinha.
  useEffect(() => {
    const perfil = session?.user.id;
    if (!perfil) return;
    return subscribeToNotifications(perfil, (nova) => {
      setItems((atual) => [nova, ...atual]);
    });
  }, [session?.user.id]);

  const naoLidas = useMemo(() => items.filter((i) => !i.read_at).length, [items]);

  const filtradas = useMemo(() => {
    if (filtro === 'todas') return items;
    if (filtro === 'nao_lidas') return items.filter((i) => !i.read_at);
    return items.filter((i) => i.categoria === filtro);
  }, [items, filtro]);

  async function abrir(item: AppNotification) {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id);
        decrementarNaoLidas();
      } catch {
        // Falha ao marcar não pode impedir a navegação: o usuário quer chegar
        // ao registro, e a marcação se resolve na próxima leitura da lista.
      }
      setItems((atual) =>
        atual.map((e) => (e.id === item.id ? { ...e, read_at: new Date().toISOString() } : e)),
      );
    }
    const destino = destinoDaNotificacao(item);
    if (destino) router.push(destino as never);
  }

  async function lerTodas() {
    await markAllNotificationsRead();
    zerarNaoLidas();
    setItems((atual) => atual.map((i) => ({ ...i, read_at: new Date().toISOString() })));
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.back}>
          <ChevronLeft size={21} color={colors.textOnBrand} />
        </Pressable>
        <View style={styles.headerText}>
          <Text variant="screenTitle" color={colors.textOnBrand}>
            Notificações
          </Text>
          <Text variant="body" color={colors.slate200}>
            {naoLidas > 0 ? `${naoLidas} não lida(s)` : 'Tudo em dia'}
          </Text>
        </View>
        <Bell size={22} color={colors.textOnBrand} />
      </View>

      <View style={styles.filtrosArea}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
          {FILTROS.map((f) => {
            const ativo = filtro === f.chave;
            return (
              <Pressable
                key={f.chave}
                onPress={() => setFiltro(f.chave)}
                style={[styles.filtro, ativo ? styles.filtroAtivo : styles.filtroInativo]}>
                <Text variant="meta" color={ativo ? colors.textOnBrand : colors.textSecondary}>
                  {f.rotulo}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {naoLidas > 0 ? (
          <Pressable
            onPress={() => {
              void lerTodas();
            }}
            style={styles.lerTodas}>
            <Text variant="meta" color={colors.brand}>
              MARCAR TODAS COMO LIDAS ({naoLidas})
            </Text>
          </Pressable>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtradas.length === 0 ? (
          <View style={styles.vazio}>
            <Bell size={30} color={colors.textMuted} />
            <Text variant="bodyStrong">
              {items.length === 0 ? 'Nenhuma notificação' : 'Nada neste filtro'}
            </Text>
            <Text variant="body" color={colors.textSecondary} style={styles.centro}>
              {items.length === 0
                ? 'Atualizações importantes aparecerão aqui.'
                : 'Escolha outro filtro para ver o restante.'}
            </Text>
          </View>
        ) : (
          filtradas.map((item) => (
            <Cartao
              key={item.id}
              item={item}
              onPress={() => {
                void abrir(item);
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Cartao({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const Icone =
    (item.categoria ? ICONE_CATEGORIA[item.categoria] : undefined) ??
    ICONE_TOM[item.kind] ??
    Bell;
  const cor = corDaNotificacao(item);
  const urgente = item.priority === 'urgent';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        !item.read_at && styles.naoLida,
        urgente && styles.urgente,
        pressed && styles.pressionado,
      ]}>
      <View style={[styles.icone, { backgroundColor: `${cor}15`, borderColor: `${cor}25` }]}>
        <Icone size={21} color={cor} />
      </View>

      <View style={styles.corpo}>
        <View style={styles.topo}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {item.title}
          </Text>
          <Text variant="meta" color={item.read_at ? colors.textMuted : cor}>
            {formatarData(item.created_at)}
          </Text>
        </View>

        <Text variant="body" color={colors.textSecondary}>
          {item.body ?? 'Atualização disponível no sistema.'}
        </Text>

        {urgente ? (
          <View style={styles.seloUrgente}>
            <AlertCircle size={12} color={colors.dangerStrong} />
            <Text variant="meta" color={colors.dangerStrong}>
              Urgente
            </Text>
          </View>
        ) : null}
      </View>

      {!item.read_at ? <View style={[styles.ponto, { backgroundColor: cor }]} /> : null}
    </Pressable>
  );
}

function formatarData(valor: string) {
  const data = new Date(valor);
  const hoje = new Date();
  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  flex: { flex: 1 },
  centro: { textAlign: 'center' },

  header: {
    backgroundColor: colors.brandStrong,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: spacing.xs },

  filtrosArea: {
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  filtros: { gap: spacing.sm, paddingHorizontal: layout.screenPadding },
  filtro: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filtroAtivo: { backgroundColor: colors.brand, borderColor: colors.brand },
  filtroInativo: { backgroundColor: colors.bgSurface, borderColor: colors.border },

  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  lerTodas: { alignSelf: 'flex-end', paddingVertical: spacing.xs },

  card: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    ...elevation.card,
  },
  naoLida: { borderColor: colors.brandSoft },
  urgente: { borderWidth: 2, borderColor: colors.danger },
  icone: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: { flex: 1, gap: spacing.xs },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  seloUrgente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  ponto: { width: 8, height: 8, borderRadius: radius.pill, marginTop: spacing.xs },

  vazio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  pressionado: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
