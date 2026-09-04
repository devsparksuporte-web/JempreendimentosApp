import { useFocusEffect, useRouter } from 'expo-router';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileSignature,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartoesDeResumo } from '@/components/CartoesDeResumo';
import { comparavel, Filtros } from '@/components/Filtros';
import { Tabela, type Coluna } from '@/components/Tabela';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/lib/alerta';
import { formatDate } from '@/lib/format';
import {
  cancelarLancamento,
  darBaixa,
  emReais,
  estaAtrasado,
  fetchLancamentos,
  gerarFaturasDoMes,
  ROTULO_LANCAMENTO,
  totalizar,
  type Lancamento,
} from '@/services/financeiro';
import { colors, layout, radius, spacing } from '@/theme/tokens';

/**
 * Financeiro da administração: o que vence no mês.
 *
 * O recorte é por vencimento, não por criação — quem abre esta tela quer
 * saber o que entra e o que sai neste mês, não o que foi digitado nele.
 *
 * As faturas dos contratos não são criadas aqui uma a uma: o botão chama a
 * função do banco, que percorre os contratos ativos. Rodar de novo no mesmo
 * mês não duplica nada, porque existe índice único por contrato e
 * vencimento (migração 0030) — então o botão pode ser apertado sem medo.
 */

type Recorte = 'todos' | 'receber' | 'pagar' | 'atrasados';

const RECORTES: { chave: Recorte; rotulo: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'receber', rotulo: 'A receber' },
  { chave: 'pagar', rotulo: 'A pagar' },
  { chave: 'atrasados', rotulo: 'Atrasados' },
];

const TOM: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  pago: 'success',
  pendente: 'warning',
  atrasado: 'danger',
  cancelado: 'neutral',
};

/** Primeiro e último dia do mês, pelas partes locais da data. */
function limitesDoMes(referencia: Date) {
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth();
  const dois = (n: number) => String(n).padStart(2, '0');
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return {
    de: `${ano}-${dois(mes + 1)}-01`,
    ate: `${ano}-${dois(mes + 1)}-${dois(ultimo)}`,
  };
}

function nomeDoMes(d: Date) {
  const t = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function FinanceiroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mes, setMes] = useState(() => new Date());
  const [itens, setItens] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recorte, setRecorte] = useState<Recorte>('todos');
  const [texto, setTexto] = useState('');

  const { de, ate } = useMemo(() => limitesDoMes(mes), [mes]);

  const carregar = useCallback(async () => {
    try {
      const lista = await fetchLancamentos(de, ate);
      setErro(null);
      setItens(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o financeiro.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [de, ate]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const totais = useMemo(() => totalizar(itens), [itens]);

  const filtrados = useMemo(() => {
    const porRecorte = itens.filter((l) => {
      if (recorte === 'receber') return l.type === 'receber';
      if (recorte === 'pagar') return l.type === 'pagar';
      if (recorte === 'atrasados') return estaAtrasado(l);
      return true;
    });
    const alvo = comparavel(texto);
    if (!alvo) return porRecorte;
    return porRecorte.filter((l) =>
      comparavel([l.description, l.client?.name, l.category].filter(Boolean).join(' ')).includes(alvo),
    );
  }, [itens, recorte, texto]);

  async function baixar(l: Lancamento) {
    try {
      await darBaixa(l.id);
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível dar baixa', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }

  async function cancelar(l: Lancamento) {
    try {
      await cancelarLancamento(l.id);
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível cancelar', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }

  async function gerar() {
    if (gerando) return;
    setGerando(true);
    try {
      const quantas = await gerarFaturasDoMes(mes);
      Alert.alert(
        'Faturamento do mês',
        quantas > 0
          ? `${quantas} fatura(s) gerada(s) a partir dos contratos ativos.`
          : 'Nenhuma fatura nova: os contratos ativos deste mês já estavam faturados.',
      );
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível gerar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setGerando(false);
    }
  }

  const colunas: Coluna<Lancamento>[] = [
    {
      titulo: 'Vencimento',
      largura: 104,
      celula: (l) => (
        <Text variant="meta" color={estaAtrasado(l) ? colors.dangerStrong : colors.textMuted}>
          {formatDate(l.due_date)}
        </Text>
      ),
    },
    {
      titulo: 'Descrição',
      peso: 2,
      celula: (l) => (
        <Text variant="body" numberOfLines={1}>
          {l.description}
        </Text>
      ),
    },
    {
      titulo: 'Cliente',
      peso: 1.4,
      celula: (l) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {l.client?.name ?? (l.type === 'pagar' ? 'Despesa da empresa' : '—')}
        </Text>
      ),
    },
    {
      titulo: 'Valor',
      largura: 116,
      aoDireita: true,
      celula: (l) => (
        <Text
          variant="bodyStrong"
          color={l.type === 'receber' ? colors.successStrong : colors.textPrimary}>
          {emReais(Number(l.amount))}
        </Text>
      ),
    },
    {
      titulo: 'Situação',
      largura: 108,
      aoDireita: true,
      celula: (l) => (
        <Badge
          label={estaAtrasado(l) ? 'Atrasado' : ROTULO_LANCAMENTO[l.status]}
          tone={estaAtrasado(l) ? 'danger' : TOM[l.status]}
        />
      ),
    },
    {
      titulo: 'Ações',
      largura: 96,
      aoDireita: true,
      celula: (l) =>
        l.status === 'pendente' ? (
          <View style={styles.acoes}>
            <Pressable
              onPress={() => void baixar(l)}
              accessibilityLabel="Dar baixa"
              style={styles.acaoIcone}>
              <CheckCircle2 size={17} color={colors.successStrong} />
            </Pressable>
            <Pressable
              onPress={() => void cancelar(l)}
              accessibilityLabel="Cancelar lançamento"
              style={styles.acaoIcone}>
              <Ban size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Text variant="meta" color={colors.textMuted}>
            —
          </Text>
        ),
    },
  ];

  return (
    <View style={styles.raiz}>
      <Header
        title="Financeiro"
        eyebrow="Contas a receber e a pagar"
        onBack={() => router.back()}
      />

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
          <Card>
            <View style={styles.mes}>
              <Pressable
                onPress={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
                accessibilityLabel="Mês anterior"
                style={styles.seta}>
                <ChevronLeft size={19} color={colors.textSecondary} />
              </Pressable>
              <Text variant="cardTitle">{nomeDoMes(mes)}</Text>
              <Pressable
                onPress={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
                accessibilityLabel="Próximo mês"
                style={styles.seta}>
                <ChevronRight size={19} color={colors.textSecondary} />
              </Pressable>
            </View>
          </Card>

          {carregando ? (
            <LoadingState />
          ) : erro ? (
            <ErrorState message={erro} onRetry={carregar} />
          ) : (
            <>
              <CartoesDeResumo
                itens={[
                  {
                    icone: TrendingUp,
                    rotulo: 'A receber',
                    valor: emReais(totais.aReceber),
                    valorPequeno: true,
                    apoio: 'Pendente no mês',
                  },
                  {
                    icone: Wallet,
                    rotulo: 'Recebido',
                    valor: emReais(totais.recebido),
                    valorPequeno: true,
                    apoio: 'Baixado no mês',
                    apoioCor: colors.successStrong,
                  },
                  {
                    icone: TrendingDown,
                    rotulo: 'A pagar',
                    valor: emReais(totais.aPagar),
                    valorPequeno: true,
                    apoio: 'Despesas pendentes',
                  },
                  {
                    icone: CircleDollarSign,
                    rotulo: 'Atrasado',
                    valor: emReais(totais.atrasado),
                    valorPequeno: true,
                    apoio: totais.atrasado > 0 ? 'Vencido e em aberto' : 'Nada vencido',
                    apoioCor: totais.atrasado > 0 ? colors.dangerStrong : colors.textMuted,
                  },
                ]}
              />

              <View style={styles.botoes}>
                <Button
                  label="GERAR FATURAS DO MÊS"
                  icon={ReceiptText}
                  loading={gerando}
                  onPress={() => {
                    void gerar();
                  }}
                />
                <Button
                  label="CONTRATOS"
                  icon={FileSignature}
                  variant="secondary"
                  onPress={() => router.push('/(admin)/contratos' as never)}
                />
              </View>

              <Filtros
                opcoes={RECORTES}
                valor={recorte}
                aoTrocar={setRecorte}
                busca={{ valor: texto, aoDigitar: setTexto, dica: 'Filtrar por descrição ou cliente' }}
              />

              {filtrados.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title={texto ? 'Nada encontrado' : 'Nenhum lançamento no mês'}
                  description={
                    texto
                      ? `Nenhum lançamento deste recorte combina com “${texto}”.`
                      : 'Use "Gerar faturas do mês" para faturar os contratos ativos deste período.'
                  }
                />
              ) : (
                <Tabela
                  itens={filtrados}
                  colunas={colunas}
                  chave={(l) => l.id}
                  cartao={(l) => (
                    <Card style={styles.cartao}>
                      <View style={styles.linhaTopo}>
                        <View style={styles.flex}>
                          <Text variant="bodyStrong" numberOfLines={2}>
                            {l.description}
                          </Text>
                          <Text variant="meta" color={colors.textSecondary}>
                            {l.client?.name ?? (l.type === 'pagar' ? 'Despesa da empresa' : '—')}
                          </Text>
                        </View>
                        <Badge
                          label={estaAtrasado(l) ? 'Atrasado' : ROTULO_LANCAMENTO[l.status]}
                          tone={estaAtrasado(l) ? 'danger' : TOM[l.status]}
                        />
                      </View>

                      <View style={styles.linhaTopo}>
                        <Text
                          variant="kpi"
                          color={l.type === 'receber' ? colors.successStrong : colors.textPrimary}>
                          {emReais(Number(l.amount))}
                        </Text>
                        <Text
                          variant="meta"
                          color={estaAtrasado(l) ? colors.dangerStrong : colors.textMuted}>
                          Vence {formatDate(l.due_date)}
                        </Text>
                      </View>

                      {l.status === 'pendente' ? (
                        <View style={styles.acoesCartao}>
                          <Pressable
                            onPress={() => void baixar(l)}
                            style={({ pressed }) => [styles.acaoPilula, pressed && styles.tocada]}>
                            <CheckCircle2 size={15} color={colors.successStrong} />
                            <Text variant="meta" color={colors.successStrong}>
                              Dar baixa
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void cancelar(l)}
                            style={({ pressed }) => [styles.acaoPilula, pressed && styles.tocada]}>
                            <Ban size={15} color={colors.textMuted} />
                            <Text variant="meta" color={colors.textSecondary}>
                              Cancelar
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </Card>
                  )}
                />
              )}
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
  mes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seta: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgApp,
  },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  flex: { flex: 1, gap: 2 },
  cartao: { gap: spacing.md },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  acoes: { flexDirection: 'row', gap: spacing.xs },
  acaoIcone: { padding: spacing.xs },
  acoesCartao: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acaoPilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tocada: { opacity: 0.85 },
});
