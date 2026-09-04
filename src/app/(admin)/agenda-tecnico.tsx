import { useFocusEffect, useRouter } from 'expo-router';
import { HardHat } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorDeHorario } from '@/components/SeletorDeHorario';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { fetchDistributionTechnicians, type DistributionTechnician } from '@/services/distribution';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/**
 * Agenda de um técnico, dia a dia.
 *
 * Técnico → data → faixas ocupadas → chamado. É a mesma grade que a tela de
 * agendamento usa para escolher horário, só que sem escolher: se as duas
 * telas desenhassem a disponibilidade de formas diferentes, uma delas
 * mentiria em algum momento.
 */
export default function AgendaDoTecnicoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tecnicos, setTecnicos] = useState<DistributionTechnician[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await fetchDistributionTechnicians();
      setErro(null);
      setTecnicos(lista);
      setEscolhido((atual) => atual ?? lista[0]?.technician_id ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a equipe.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  return (
    <View style={styles.raiz}>
      <Header
        title="Agenda da equipe"
        eyebrow="Horários ocupados por técnico"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.rolagem}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.coluna, { paddingBottom: insets.bottom + spacing.xxl }]}>
          {carregando ? (
            <LoadingState />
          ) : erro ? (
            <ErrorState message={erro} onRetry={carregar} />
          ) : tecnicos.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                Nenhum técnico ativo cadastrado.
              </Text>
            </Card>
          ) : (
            <>
              <View style={styles.equipe}>
                {tecnicos.map((t) => {
                  const ativo = escolhido === t.technician_id;
                  return (
                    <Pressable
                      key={t.technician_id}
                      onPress={() => setEscolhido(t.technician_id)}
                      style={[styles.pilula, ativo && styles.pilulaAtiva]}>
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

              {escolhido ? (
                <Card style={styles.grade}>
                  <SeletorDeHorario
                    // A chave força a grade a remontar ao trocar de técnico,
                    // em vez de mostrar por um instante a agenda do anterior.
                    key={escolhido}
                    technicianId={escolhido}
                    valor={null}
                    somenteLeitura
                  />
                </Card>
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
  rolagem: { flexGrow: 1, alignItems: 'center' },
  coluna: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  equipe: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pilula: {
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
  pilulaAtiva: { backgroundColor: colors.brand, borderColor: colors.brand },
  grade: { gap: spacing.md },
});
