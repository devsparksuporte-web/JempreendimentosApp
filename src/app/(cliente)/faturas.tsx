import { useFocusEffect } from 'expo-router';
import { CalendarClock, CheckCircle2, ReceiptText } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoesDeResumo } from '@/components/CartoesDeResumo';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/format';
import {
  emReais,
  estaAtrasado,
  fetchMinhasFaturas,
  ROTULO_LANCAMENTO,
  type Lancamento,
} from '@/services/financeiro';
import { colors, layout, spacing } from '@/theme/tokens';

/**
 * Minhas faturas — o que o cliente deve, visto por ele.
 *
 * Só contas a receber, e só as dele: quem decide isso é a RLS (migração
 * 0030), não um filtro aqui. Despesa da empresa nunca sai da administração.
 *
 * É uma tela de consulta. Não há botão de pagar: o sistema não processa
 * pagamento, e um botão que abre "indisponível" ensina a desconfiar da
 * interface inteira.
 */
export default function FaturasScreen() {
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const lista = await fetchMinhasFaturas();
      setErro(null);
      setItens(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar suas faturas.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const resumo = useMemo(() => {
    const soma = (l: Lancamento[]) => l.reduce((t, i) => t + Number(i.amount), 0);
    const abertas = itens.filter((l) => l.status === 'pendente');
    const vencidas = itens.filter(estaAtrasado);
    const proxima = abertas.map((l) => l.due_date).sort()[0] ?? null;
    return {
      emAberto: soma(abertas),
      vencido: soma(vencidas),
      quantasVencidas: vencidas.length,
      proxima,
    };
  }, [itens]);

  return (
    <View style={styles.raiz}>
      <Header title="Minhas faturas" eyebrow="Contas do seu contrato" />

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
              icon={ReceiptText}
              title="Nenhuma fatura"
              description="Quando houver cobrança do seu contrato ou de um atendimento, ela aparece aqui."
            />
          ) : (
            <>
              <CartoesDeResumo
                itens={[
                  {
                    icone: ReceiptText,
                    rotulo: 'Em aberto',
                    valor: emReais(resumo.emAberto),
                    valorPequeno: true,
                    apoio: 'Total pendente',
                  },
                  {
                    icone: CalendarClock,
                    rotulo: 'Próximo vencimento',
                    valor: resumo.proxima ? formatDate(resumo.proxima) : 'Nada a vencer',
                    valorPequeno: true,
                    apoio: resumo.proxima ? 'Fatura mais próxima' : 'Sem pendências',
                    apoioCor: colors.brand,
                  },
                  {
                    icone: CheckCircle2,
                    rotulo: 'Vencido',
                    valor: emReais(resumo.vencido),
                    valorPequeno: true,
                    apoio:
                      resumo.quantasVencidas > 0
                        ? `${resumo.quantasVencidas} fatura(s) em atraso`
                        : 'Nada em atraso',
                    apoioCor:
                      resumo.quantasVencidas > 0 ? colors.dangerStrong : colors.successStrong,
                  },
                ]}
              />

              {itens.map((l) => (
                <Card key={l.id} style={styles.cartao}>
                  <View style={styles.topo}>
                    <View style={styles.flex}>
                      <Text variant="cardTitle" numberOfLines={2}>
                        {l.description}
                      </Text>
                      <Text variant="meta" color={colors.textMuted}>
                        Vencimento {formatDate(l.due_date)}
                      </Text>
                    </View>
                    <Badge
                      label={estaAtrasado(l) ? 'Atrasado' : ROTULO_LANCAMENTO[l.status]}
                      tone={
                        estaAtrasado(l) ? 'danger' : l.status === 'pago' ? 'success' : 'warning'
                      }
                    />
                  </View>

                  <View style={styles.topo}>
                    <Text variant="kpi">{emReais(Number(l.amount))}</Text>
                    {l.paid_at ? (
                      <Text variant="meta" color={colors.successStrong}>
                        Pago em {formatDate(l.paid_at)}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))}

              <Text variant="meta" color={colors.textMuted} style={styles.aviso}>
                Dúvida sobre uma cobrança? Fale com a equipe pela conversa do chamado ou pelo
                telefone da empresa.
              </Text>
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
    gap: spacing.md,
  },
  cartao: { gap: spacing.md },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: { flex: 1, gap: 2 },
  aviso: { textAlign: 'center', paddingTop: spacing.md },
});
