import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarCheck, CalendarX2, HardHat } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorDeHorario } from '@/components/SeletorDeHorario';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Section } from '@/components/ui/Section';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/alerta';
import { formatDate } from '@/lib/format';
import { agendarAtendimento, cancelarAgendamento, faixaBonita } from '@/services/agenda';
import { fetchServiceCall, type ServiceCallDetailed } from '@/services/client';
import { fetchDistributionTechnicians, type DistributionTechnician } from '@/services/distribution';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/**
 * Marcar, remarcar ou liberar o horário de um atendimento.
 *
 * Uma tela só para os três papéis. Quem pode fazer o quê é o banco que
 * decide — `can_see_call` para agendar, `is_admin` para trocar o técnico —,
 * então aqui não há ramificação por papel além do que a pessoa consegue ver.
 *
 * Remarcar não tem função própria: é gravar outro intervalo na mesma linha
 * do chamado. O horário antigo se libera porque deixou de existir.
 */
export default function AgendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();

  const [call, setCall] = useState<ServiceCallDetailed | null>(null);
  const [tecnicos, setTecnicos] = useState<DistributionTechnician[]>([]);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<Date | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehAdmin = role === 'admin';

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const c = await fetchServiceCall(id);
      setErro(null);
      setCall(c);
      setTecnicoId(c?.technician_id ?? null);
      setEscolhido(c?.scheduled_for ? new Date(c.scheduled_for) : null);
      if (ehAdmin) setTecnicos(await fetchDistributionTechnicians());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o chamado.');
    } finally {
      setCarregando(false);
    }
  }, [id, ehAdmin]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  async function salvar() {
    if (!call || !escolhido || salvando) return;
    setSalvando(true);
    try {
      await agendarAtendimento({
        callId: call.id,
        inicio: escolhido,
        technicianId: tecnicoId !== call.technician_id ? (tecnicoId ?? undefined) : undefined,
      });
      Alert.alert(
        'Atendimento agendado',
        `${formatDate(escolhido.toISOString())} às ${faixaBonita(escolhido.toISOString(), null)}.`,
      );
      router.back();
    } catch (e) {
      // A mensagem de conflito já vem pronta do banco, com o texto certo
      // para agendar e para reagendar. Reescrevê-la aqui só criaria uma
      // segunda versão para desencontrar.
      Alert.alert('Horário indisponível', e instanceof Error ? e.message : 'Tente outro horário.');
    } finally {
      setSalvando(false);
    }
  }

  async function liberar() {
    if (!call || salvando) return;
    setSalvando(true);
    try {
      await cancelarAgendamento(call.id);
      Alert.alert('Agendamento cancelado', 'O horário voltou a ficar disponível.');
      router.back();
    } catch (e) {
      Alert.alert('Não foi possível cancelar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.raiz}>
      <Header
        title={call?.scheduled_for ? 'Reagendar atendimento' : 'Agendar atendimento'}
        eyebrow={call ? `Chamado #${call.code}` : 'Agenda'}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.pagina, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.coluna}>
          {carregando ? (
            <LoadingState />
          ) : erro ? (
            <ErrorState message={erro} onRetry={carregar} />
          ) : !call ? (
            <ErrorState message="Chamado não encontrado." onRetry={carregar} />
          ) : (
            <>
              {call.scheduled_for ? (
                <Card>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    AGENDAMENTO ATUAL
                  </Text>
                  <Text variant="cardTitle">{formatDate(call.scheduled_for)}</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {faixaBonita(call.scheduled_for, call.scheduled_end)}
                  </Text>
                </Card>
              ) : null}

              {ehAdmin ? (
                <Section label="Técnico responsável">
                  <View style={styles.escolhas}>
                    {tecnicos.map((t) => {
                      const ativo = tecnicoId === t.technician_id;
                      return (
                        <Pressable
                          key={t.technician_id}
                          onPress={() => setTecnicoId(t.technician_id)}
                          style={[styles.escolha, ativo && styles.escolhaAtiva]}>
                          <HardHat size={15} color={ativo ? colors.textOnBrand : colors.brand} />
                          <Text
                            variant="meta"
                            color={ativo ? colors.textOnBrand : colors.textSecondary}>
                            {t.profile?.full_name ?? 'Técnico'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Section>
              ) : null}

              {tecnicoId ? (
                <Section label="Horários do técnico">
                  <SeletorDeHorario
                    technicianId={tecnicoId}
                    valor={escolhido}
                    aoEscolher={setEscolhido}
                  />
                </Section>
              ) : (
                <Card>
                  <Text variant="body" color={colors.textSecondary}>
                    Este chamado ainda não tem técnico responsável. A administração precisa definir
                    um antes de marcar o horário.
                  </Text>
                </Card>
              )}

              {tecnicoId ? (
                <Button
                  label={call.scheduled_for ? 'CONFIRMAR NOVO HORÁRIO' : 'CONFIRMAR AGENDAMENTO'}
                  icon={CalendarCheck}
                  loading={salvando}
                  disabled={!escolhido}
                  onPress={() => {
                    void salvar();
                  }}
                />
              ) : null}

              {call.scheduled_for ? (
                <Button
                  label="CANCELAR AGENDAMENTO"
                  icon={CalendarX2}
                  variant="danger"
                  disabled={salvando}
                  onPress={() => {
                    void liberar();
                  }}
                />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bgApp },
  pagina: { alignItems: 'center' },
  coluna: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  escolha: {
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
  escolhaAtiva: { backgroundColor: colors.brand, borderColor: colors.brand },
});
