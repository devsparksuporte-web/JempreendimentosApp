import { useRouter } from 'expo-router';
import { ChevronLeft, LayoutGrid } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/format';
import { fetchAdminDashboard, type AdminDashboard } from '@/services/admin';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/** A tela é de parede: recarrega sozinha, sem ninguém para puxar. */
const INTERVALO_MS = 60_000;

const DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function horaCheia(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "há 2h 15min" — o tempo que o chamado está esperando. */
function tempoDeEspera(desde: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(desde).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default function AdminPainelTvScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [data, setData] = useState<AdminDashboard | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchAdminDashboard());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const dados = setInterval(load, INTERVALO_MS);
    const relogio = setInterval(() => setAgora(new Date()), 30_000);
    return () => {
      clearInterval(dados);
      clearInterval(relogio);
    };
  }, [load]);

  const emAtendimento =
    data?.calls.filter((c) => ['a_caminho', 'em_atendimento'].includes(c.status)).length ?? 0;

  /** Em tela estreita as tabelas não cabem; a lista vira cartões empilhados. */
  const telaLarga = width >= 900;

  return (
    <View style={styles.root}>
      {/* Faixa superior navy */}
      <View style={[styles.faixa, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.faixaEsquerda}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.voltar, pressed && styles.pressed]}>
            <ChevronLeft size={22} color={colors.textOnBrand} />
          </Pressable>

          <View style={styles.marca}>
            <View style={[styles.barra, styles.barraClara]} />
            <View style={[styles.barra, styles.barraMedia]} />
            <View style={[styles.barra, styles.barraClara]} />
          </View>

          <View>
            <Text variant="screenTitle" color={colors.textOnBrand} style={styles.marcaNome}>
              JEMPREENDIMENTOS
            </Text>
            <Text variant="microLabel" color={colors.brandSoft}>
              Gestão de serviços · Operação ao vivo
            </Text>
          </View>
        </View>

        <View style={styles.faixaDireita}>
          <View style={styles.monitorado}>
            <View style={styles.monitoradoPonto} />
            <Text variant="meta" color={colors.textOnBrand}>
              Sistema monitorado
            </Text>
          </View>

          <View style={styles.relogio}>
            <Text style={styles.hora}>{horaCheia(agora)}</Text>
            <Text variant="meta" color={colors.brandSoft}>
              {DIAS[agora.getDay()]}, {agora.getDate()} de {MESES[agora.getMonth()]}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        <ScrollView
          contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}>
          {/* Linha de indicadores gigantes */}
          <View style={styles.indicadores}>
            <Indicador
              rotulo="Chamados abertos"
              valor={data.totals.open}
              apoio="Solicitações pendentes"
              cor={colors.textPrimary}
              largo={telaLarga}
            />
            <Indicador
              rotulo="Críticos"
              valor={data.totals.urgent}
              apoio="Ação imediata"
              cor={colors.dangerStrong}
              destaque
              largo={telaLarga}
            />
            <Indicador
              rotulo="Em atendimento"
              valor={emAtendimento}
              apoio="Técnicos executando"
              cor={colors.brand}
              largo={telaLarga}
            />
            <Indicador
              rotulo="Técnicos livres"
              valor={data.totals.techniciansAvailable}
              apoio="Disponibilidade agora"
              cor={colors.successStrong}
              largo={telaLarga}
            />
            <Indicador
              rotulo="Preventivas"
              valor={data.maintenanceDue}
              apoio="Próximos 7 dias"
              cor={colors.textPrimary}
              largo={telaLarga}
            />
          </View>

          {/* Fila de atendimento */}
          <View style={styles.painel}>
            <View style={styles.painelCabecalho}>
              <View style={styles.painelTitulo}>
                <Text variant="microLabel" color={colors.textSecondary}>
                  Fila de atendimento
                </Text>
                <View style={styles.contador}>
                  <Text variant="meta" color={colors.brand}>
                    {String(data.calls.length).padStart(2, '0')} chamados ativos
                  </Text>
                </View>
              </View>
              <LayoutGrid size={20} color={colors.slate300} />
            </View>

            {data.calls.length === 0 ? (
              <View style={styles.vazio}>
                <Text variant="cardTitle" color={colors.textSecondary}>
                  Nenhum chamado na fila
                </Text>
              </View>
            ) : (
              <>
                {telaLarga ? (
                  <View style={styles.linhaCabecalho}>
                    <Text variant="meta" color={colors.textMuted} style={styles.colId}>
                      OS
                    </Text>
                    <Text variant="meta" color={colors.textMuted} style={styles.colNome}>
                      Cliente
                    </Text>
                    <Text variant="meta" color={colors.textMuted} style={styles.colNome}>
                      Técnico
                    </Text>
                    <Text variant="meta" color={colors.textMuted} style={styles.colStatus}>
                      Status
                    </Text>
                    <Text variant="meta" color={colors.textMuted} style={styles.colTempo}>
                      Espera
                    </Text>
                  </View>
                ) : null}

                {data.calls.slice(0, 12).map((c) => {
                  const critico = c.priority === 'urgente';
                  return (
                    <View
                      key={c.id}
                      style={[styles.linha, critico && styles.linhaCritica]}>
                      {telaLarga ? (
                        <>
                          <Text variant="bodyStrong" style={styles.colId}>
                            #{c.code}
                          </Text>
                          <Text variant="body" numberOfLines={1} style={styles.colNome}>
                            {c.client?.name ?? 'Cliente'}
                          </Text>
                          <Text
                            variant="body"
                            color={colors.textSecondary}
                            numberOfLines={1}
                            style={styles.colNome}>
                            {c.technician?.profile?.full_name ?? 'Sem técnico'}
                          </Text>
                          <Text
                            variant="body"
                            color={critico ? colors.dangerStrong : colors.brand}
                            numberOfLines={1}
                            style={styles.colStatus}>
                            {STATUS_LABEL[c.status]}
                          </Text>
                          <Text
                            variant="bodyStrong"
                            color={critico ? colors.dangerStrong : colors.textSecondary}
                            style={styles.colTempo}>
                            {tempoDeEspera(c.created_at)}
                          </Text>
                        </>
                      ) : (
                        <View style={styles.cartaoCompacto}>
                          <View style={styles.cartaoTopo}>
                            <Text variant="bodyStrong">
                              #{c.code} · {c.client?.name ?? 'Cliente'}
                            </Text>
                            <Text
                              variant="bodyStrong"
                              color={critico ? colors.dangerStrong : colors.textSecondary}>
                              {tempoDeEspera(c.created_at)}
                            </Text>
                          </View>
                          <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                            {STATUS_LABEL[c.status]} · {PRIORITY_LABEL[c.priority]} ·{' '}
                            {c.technician?.profile?.full_name ?? 'Sem técnico'}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>

          <Text variant="meta" color={colors.textMuted} style={styles.rodape}>
            Atualiza sozinho a cada minuto · última leitura às {horaCheia(agora)}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

function Indicador({
  rotulo,
  valor,
  apoio,
  cor,
  destaque = false,
  largo,
}: {
  rotulo: string;
  valor: number;
  apoio: string;
  cor: string;
  destaque?: boolean;
  largo: boolean;
}) {
  return (
    <View
      style={[
        styles.indicador,
        { minWidth: largo ? 0 : 150, flexGrow: 1, flexBasis: largo ? 0 : '30%' },
        destaque && styles.indicadorCritico,
      ]}>
      <Text variant="meta" color={colors.textSecondary} style={styles.centro}>
        {rotulo}
      </Text>
      <Text style={[styles.numeroGigante, { color: cor }]}>
        {String(valor).padStart(2, '0')}
      </Text>
      <Text variant="meta" color={destaque ? colors.dangerStrong : colors.textMuted} style={styles.centro}>
        {apoio}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  centro: { textAlign: 'center' },

  faixa: {
    backgroundColor: colors.brandStrong,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  faixaEsquerda: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  voltar: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 44 },
  barra: { width: 10, borderRadius: radius.pill },
  barraClara: { height: '100%', backgroundColor: colors.brandSoft },
  barraMedia: { height: '66%', backgroundColor: colors.brand },
  marcaNome: { letterSpacing: 0.5 },

  faixaDireita: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  monitorado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  monitoradoPonto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  relogio: { alignItems: 'flex-end' },
  hora: {
    color: colors.textOnBrand,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 56,
  },

  conteudo: { padding: spacing.xl, gap: spacing.lg },

  indicadores: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  indicador: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  indicadorCritico: { borderWidth: 2, borderColor: colors.danger },
  numeroGigante: { fontSize: 54, fontWeight: '800', letterSpacing: -2, lineHeight: 60 },

  painel: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    overflow: 'hidden',
  },
  painelCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  painelTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contador: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },

  linhaCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.slate50,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  linhaCritica: { backgroundColor: colors.dangerSoft },
  colId: { width: 80 },
  colNome: { flex: 2 },
  colStatus: { flex: 1.4 },
  colTempo: { width: 100, textAlign: 'right' },

  cartaoCompacto: { flex: 1, gap: spacing.xs },
  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  vazio: { padding: spacing.xxl, alignItems: 'center' },
  rodape: { textAlign: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
