import { useLocalSearchParams, useRouter } from 'expo-router';
import { AirVent, HardHat, MapPin, MessageCircle, Phone, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { Section } from '@/components/ui/Section';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  equipmentName,
  formatTime,
  STATUS_LABEL,
  STATUS_LIVE,
  STATUS_TONE,
} from '@/lib/format';
import {
  fetchServiceCall,
  fetchStatusHistory,
  type ServiceCallDetailed,
} from '@/services/client';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import type { ServiceCallStatusHistory, ServiceStatus } from '@/types/database';

/** Etapas exibidas na timeline, na ordem do fluxo normal. */
const TIMELINE: ServiceStatus[] = [
  'aberto',
  'em_analise',
  'tecnico_atribuido',
  'a_caminho',
  'em_atendimento',
  'finalizado',
];

export default function AcompanharChamadoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [call, setCall] = useState<ServiceCallDetailed | null>(null);
  const [history, setHistory] = useState<ServiceCallStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [c, h] = await Promise.all([fetchServiceCall(id), fetchStatusHistory(id)]);
      setCall(c);
      setHistory(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o chamado.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const tecnico = call?.technician?.profile?.full_name;
  const whatsapp = null; // preenchido quando o telefone do técnico for exposto ao cliente

  return (
    <View style={styles.root}>
      <Header
        title={call ? `Chamado #${call.code}` : 'Chamado'}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(cliente)'))}
        trailing={
          call ? (
            <Badge
              label={STATUS_LABEL[call.status]}
              tone={STATUS_TONE[call.status]}
              live={STATUS_LIVE.includes(call.status)}
            />
          ) : undefined
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
          {loading ? (
            <LoadingState />
          ) : error || !call ? (
            <ErrorState message={error ?? 'Chamado não encontrado.'} onRetry={load} />
          ) : (
            <>
              {call.equipment ? (
                <Card>
                  <View style={styles.row}>
                    <IconTile icon={AirVent} />
                    <View style={styles.flex}>
                      <Text variant="cardTitle">{equipmentName(call.equipment)}</Text>
                      <Text variant="meta" color={colors.textSecondary}>
                        {[call.equipment.environment, call.address?.complement]
                          .filter(Boolean)
                          .join(' — ') || call.title}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}

              {call.status === 'a_caminho' ? (
                <Card accentBorder={colors.brandSoft}>
                  <View style={styles.row}>
                    <IconTile icon={MapPin} />
                    <View style={styles.flex}>
                      <Text variant="microLabel" color={colors.textSecondary}>
                        Técnico a caminho
                      </Text>
                      <Text variant="cardTitle">
                        {call.scheduled_for
                          ? `Previsão de chegada às ${formatTime(call.scheduled_for)}`
                          : 'A caminho do local'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : null}

              {tecnico ? (
                <Section label="Técnico responsável">
                  <Card>
                    <View style={styles.tecnico}>
                      <View style={styles.row}>
                        <IconTile icon={HardHat} />
                        <View style={styles.flex}>
                          <Text variant="cardTitle">{tecnico}</Text>
                          <Text variant="meta" color={colors.textSecondary}>
                            Técnico certificado
                          </Text>
                        </View>
                      </View>

                      <View style={styles.acoes}>
                        <View style={styles.flex}>
                          <Button
                            label="Ligar"
                            icon={Phone}
                            variant="secondary"
                            onPress={() => Linking.openURL('tel:')}
                          />
                        </View>
                        <View style={styles.flex}>
                          <Button
                            label="WhatsApp"
                            icon={MessageCircle}
                            variant="success"
                            onPress={() =>
                              Linking.openURL(whatsapp ? `https://wa.me/${whatsapp}` : 'https://wa.me/')
                            }
                          />
                        </View>
                      </View>
                    </View>
                  </Card>
                </Section>
              ) : null}

              <Section label="Acompanhamento">
                <Card>
                  <Timeline current={call.status} history={history} />
                </Card>
              </Section>

              {call.ai_summary?.resumo ? (
                <Card accentBorder={colors.aiBorder}>
                  <View style={styles.resumo}>
                    <View style={styles.resumoHeader}>
                      <Sparkles size={16} color={colors.ai} />
                      <Text variant="microLabel" color={colors.aiStrong}>
                        Resumo da IA
                      </Text>
                    </View>
                    <Text variant="body" color={colors.textSecondary}>
                      {call.ai_summary.resumo}
                    </Text>
                  </View>
                </Card>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Timeline({
  current,
  history,
}: {
  current: ServiceStatus;
  history: ServiceCallStatusHistory[];
}) {
  const currentIndex = TIMELINE.indexOf(current);

  return (
    <View>
      {TIMELINE.map((status, index) => {
        const registro = history.find((h) => h.to_status === status);
        const concluida = currentIndex > index;
        const ativa = currentIndex === index;
        const cor = concluida ? colors.success : ativa ? colors.brand : colors.slate300;
        const ultima = index === TIMELINE.length - 1;

        return (
          <View key={status} style={styles.etapa}>
            <View style={styles.marcadorColuna}>
              <View
                style={[
                  styles.marcador,
                  { borderColor: cor, backgroundColor: concluida || ativa ? cor : colors.bgSurface },
                ]}
              />
              {!ultima ? (
                <View
                  style={[
                    styles.conector,
                    { backgroundColor: concluida ? colors.success : colors.border },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.etapaTexto}>
              <Text
                variant={ativa ? 'cardTitle' : 'body'}
                color={concluida || ativa ? colors.textPrimary : colors.textMuted}>
                {STATUS_LABEL[status]}
              </Text>
              {registro ? (
                <Text variant="meta" color={colors.textMuted}>
                  {formatTime(registro.created_at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  tecnico: { gap: spacing.lg },
  acoes: { flexDirection: 'row', gap: spacing.md },
  resumo: { gap: spacing.md },
  resumoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  etapa: { flexDirection: 'row', gap: spacing.lg },
  marcadorColuna: { alignItems: 'center', width: 16 },
  marcador: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  conector: { width: 2, flex: 1, minHeight: 28, marginVertical: 2 },
  etapaTexto: { flex: 1, paddingBottom: spacing.xl, gap: 2 },
});
