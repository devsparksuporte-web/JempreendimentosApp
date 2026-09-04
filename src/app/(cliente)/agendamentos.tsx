import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, CalendarX2, HardHat, MapPin, PencilLine } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/lib/alerta';
import { formatDate, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import {
  cancelarAgendamento,
  faixaBonita,
  fetchMeusAgendamentos,
  type AgendaEntry,
} from '@/services/agenda';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/**
 * Meus agendamentos — a visita marcada, vista pelo cliente.
 *
 * Fora da barra de abas de propósito: são cinco abas no celular e uma sexta
 * espremeria todas. Fica no menu lateral da web e a um toque do painel, que
 * é de onde a pessoa realmente sai procurando "quando é a visita".
 *
 * Cancelar aqui cancela o AGENDAMENTO, não o chamado. O atendimento continua
 * na fila esperando outro horário — que é o que a pessoa quer quando diz que
 * não pode receber a equipe naquele dia.
 */
export default function AgendamentosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<AgendaEntry[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setItens(await fetchMeusAgendamentos());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar seus agendamentos.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  // Recarrega ao voltar da tela de reagendamento: sem isso a lista mostraria
  // o horário antigo até alguém puxar para atualizar.
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function liberar(item: AgendaEntry) {
    try {
      await cancelarAgendamento(item.id);
      Alert.alert('Agendamento cancelado', 'O horário voltou a ficar disponível.');
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível cancelar', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }

  return (
    <View style={styles.raiz}>
      <Header title="Meus agendamentos" eyebrow="Visitas marcadas" />

      <ScrollView
        contentContainerStyle={styles.rolagem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              void carregar();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={[styles.coluna, { paddingBottom: insets.bottom + spacing.xxl }]}>
          {carregando ? (
            <LoadingState />
          ) : erro ? (
            <ErrorState message={erro} onRetry={carregar} />
          ) : itens.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhuma visita marcada"
              description="Quando a equipe agendar seu atendimento, a data e o horário aparecem aqui."
            />
          ) : (
            itens.map((a) => (
              <Card key={a.id} style={styles.cartao}>
                <View style={styles.topo}>
                  <View style={styles.flex}>
                    <Text variant="cardTitle" numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text variant="meta" color={colors.textMuted}>
                      Chamado #{a.code}
                    </Text>
                  </View>
                  <Badge label={STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} />
                </View>

                <View style={styles.linhas}>
                  <Linha
                    icone={<HardHat size={15} color={colors.brand} />}
                    texto={a.technician?.profile?.full_name ?? 'Técnico a definir'}
                  />
                  <Linha
                    icone={<CalendarClock size={15} color={colors.brand} />}
                    texto={`${formatDate(a.scheduled_for)} · ${faixaBonita(a.scheduled_for, a.scheduled_end)}`}
                  />
                  {a.address ? (
                    <Linha
                      icone={<MapPin size={15} color={colors.brand} />}
                      texto={[
                        [a.address.street, a.address.number].filter(Boolean).join(', '),
                        a.address.district,
                        a.address.city,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  ) : null}
                </View>

                {a.description ? (
                  <View style={styles.observacoes}>
                    <Text variant="microLabel" color={colors.textSecondary}>
                      OBSERVAÇÕES
                    </Text>
                    <Text variant="meta" color={colors.textSecondary}>
                      {a.description}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.acoes}>
                  <Pressable
                    onPress={() => router.push(`/agendar/${a.id}` as never)}
                    style={({ pressed }) => [styles.acao, pressed && styles.tocada]}>
                    <PencilLine size={15} color={colors.brandStrong} />
                    <Text variant="meta" color={colors.brandStrong}>
                      Reagendar
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      void liberar(a);
                    }}
                    style={({ pressed }) => [styles.acao, pressed && styles.tocada]}>
                    <CalendarX2 size={15} color={colors.dangerStrong} />
                    <Text variant="meta" color={colors.dangerStrong}>
                      Cancelar horário
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Linha({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <View style={styles.linha}>
      {icone}
      <Text variant="body" color={colors.textSecondary} style={styles.flex}>
        {texto}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bgApp },
  rolagem: { flexGrow: 1, alignItems: 'center' },
  coluna: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  cartao: { gap: spacing.md },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  linhas: { gap: spacing.sm },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  observacoes: {
    gap: 2,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  tocada: { opacity: 0.85 },
});
