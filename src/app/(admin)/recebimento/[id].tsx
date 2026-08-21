import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ClipboardCheck, PackageCheck, Trash2, Truck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  atualizarStatusPedido,
  confirmarRecebimento,
  excluirRecebimento,
  fetchPedido,
  fetchRecebimentos,
  quantidadePedida,
  quantidadePendente,
  quantidadeRecebida,
  registrarRecebimento,
  ROTULO_PEDIDO,
  type Pedido,
  type Recebimento,
  type StatusPedido,
} from '@/services/compras';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

function paraNumero(t: string): number {
  const n = Number(t.replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Converte a validade digitada para o formato do banco.
 *
 * Retorna `undefined` quando o texto não é uma data — assim dá para separar
 * "não informou" de "digitou errado" e avisar em vez de gravar nulo calado.
 */
function paraDataIso(texto: string): string | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getDate() !== Number(dia) || d.getMonth() !== Number(mes) - 1) return undefined;
  return `${ano}-${mes}-${dia}`;
}

function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}

/** Passos que quem acompanha o pedido marca à mão. */
const PASSOS: StatusPedido[] = ['criado', 'enviado', 'confirmado', 'em_transito'];

export default function RecebimentoDetalheScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quantidade, setQuantidade] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [valorUnit, setValorUnit] = useState('');
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [observacao, setObservacao] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [p, rs] = await Promise.all([fetchPedido(id), fetchRecebimentos(id)]);
      setPedido(p);
      setRecebimentos(rs);

      // O campo já vem com o que falta: é o que se digita em 9 de 10 casos.
      const falta = quantidadePendente(p);
      setQuantidade(falta > 0 ? String(falta) : '');
      if (p.quote?.unit_price) setValorUnit(String(p.quote.unit_price));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o pedido.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function mudarStatus(status: StatusPedido) {
    if (!pedido) return;
    setOcupado(true);
    try {
      await atualizarStatusPedido(pedido.id, status);
      await load();
    } catch (e) {
      Alert.alert('Não foi possível atualizar', e instanceof Error ? e.message : '');
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Grava a entrada. Confirmando, o banco dá baixa da compra no estoque;
   * sem confirmar, fica registrada para conferir a nota depois.
   */
  async function registrar(confirmar: boolean) {
    if (!pedido) return;

    const partId = pedido.request?.part_id;
    if (!partId) {
      Alert.alert(
        'Pedido sem produto',
        'Este pedido perdeu o vínculo com a solicitação de reposição e não dá para saber o que entra no estoque.',
      );
      return;
    }

    const qtd = paraNumero(quantidade);
    if (qtd <= 0) {
      Alert.alert('Quantidade inválida', 'Informe quanto chegou, maior que zero.');
      return;
    }

    const dataValidade = paraDataIso(validade);
    if (dataValidade === undefined) {
      Alert.alert('Validade inválida', 'Use o formato DD/MM/AAAA ou deixe em branco.');
      return;
    }

    const falta = quantidadePendente(pedido);
    if (confirmar && qtd > falta && falta > 0) {
      const seguir = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Chegou mais que o pedido',
          `Faltavam ${falta} e você está dando entrada de ${qtd}. Confirmar mesmo assim?`,
          [
            { text: 'Revisar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirmar', onPress: () => resolve(true) },
          ],
        );
      });
      if (!seguir) return;
    }

    setOcupado(true);
    try {
      await registrarRecebimento(
        {
          pedidoId: pedido.id,
          partId,
          quantidadePedida: quantidadePedida(pedido),
          quantidadeRecebida: qtd,
          valorUnitario: valorUnit.trim() ? paraNumero(valorUnit) : null,
          notaFiscal: notaFiscal.trim() || null,
          lote: lote.trim() || null,
          validade: dataValidade,
          observacao: observacao.trim() || null,
        },
        confirmar,
      );

      setNotaFiscal('');
      setLote('');
      setValidade('');
      setObservacao('');
      await load();

      Alert.alert(
        confirmar ? 'Entrada confirmada' : 'Recebimento registrado',
        confirmar
          ? 'O saldo do produto foi atualizado.'
          : 'Nada entrou no estoque ainda. Confirme depois de conferir a nota.',
      );
    } catch (e) {
      Alert.alert('Não foi possível registrar', e instanceof Error ? e.message : '');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(recebimentoId: string) {
    setOcupado(true);
    try {
      await confirmarRecebimento(recebimentoId);
      await load();
    } catch (e) {
      Alert.alert('Não foi possível confirmar', e instanceof Error ? e.message : '');
    } finally {
      setOcupado(false);
    }
  }

  function excluir(recebimentoId: string) {
    Alert.alert('Apagar recebimento', 'Esta conferência ainda não confirmada será apagada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setOcupado(true);
            try {
              await excluirRecebimento(recebimentoId);
              await load();
            } catch (e) {
              Alert.alert('Não foi possível apagar', e instanceof Error ? e.message : '');
            } finally {
              setOcupado(false);
            }
          })();
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (error || !pedido) {
    return <ErrorState message={error ?? 'Pedido não encontrado.'} onRetry={load} />;
  }

  const pedida = quantidadePedida(pedido);
  const recebida = quantidadeRecebida(pedido);
  const falta = quantidadePendente(pedido);
  const unidade = pedido.request?.part?.unit ?? 'un';
  const fechado = pedido.status === 'recebido' || pedido.status === 'cancelado';

  return (
    <View style={styles.root}>
      <Header
        title={pedido.number}
        eyebrow="Pedido de compra"
        onBack={() => router.back()}
        trailing={<Badge label={ROTULO_PEDIDO[pedido.status]} tone={fechado ? 'success' : 'info'} />}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Secao titulo="O pedido">
            <Text variant="cardTitle">{pedido.request?.part?.name ?? 'Produto'}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              {pedido.supplier?.name ?? 'Fornecedor'}
              {pedido.supplier?.contact_name ? ` · ${pedido.supplier.contact_name}` : ''}
            </Text>

            <View style={styles.numeros}>
              <Numero rotulo="Pedido" valor={`${pedida} ${unidade}`} />
              <Numero rotulo="Recebido" valor={`${recebida} ${unidade}`} />
              <Numero
                rotulo="Falta"
                valor={`${falta} ${unidade}`}
                destaque={falta > 0 ? colors.warningStrong : colors.successStrong}
              />
            </View>

            <Text variant="meta" color={colors.textMuted}>
              Total {moeda(Number(pedido.total))}
              {pedido.payment_terms ? ` · ${pedido.payment_terms}` : ''}
              {dataCurta(pedido.expected_delivery)
                ? ` · previsto para ${dataCurta(pedido.expected_delivery)}`
                : ''}
            </Text>

            {pedido.request ? (
              <Pressable
                onPress={() => router.push(`/(admin)/reposicao/${pedido.request!.id}` as never)}>
                <Text variant="meta" color={colors.brand}>
                  Ver solicitação {pedido.request.number}
                </Text>
              </Pressable>
            ) : null}
          </Secao>

          {!fechado ? (
            <Secao titulo="Acompanhamento">
              <View style={styles.pills}>
                {PASSOS.map((s) => {
                  const ativo = pedido.status === s;
                  return (
                    <Pressable
                      key={s}
                      disabled={ocupado}
                      onPress={() => {
                        void mudarStatus(s);
                      }}
                      style={[styles.pill, ativo && styles.pillAtiva]}>
                      <Text
                        variant="meta"
                        color={ativo ? colors.textOnBrand : colors.textSecondary}>
                        {ROTULO_PEDIDO[s]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Button
                label="Cancelar pedido"
                variant="secondary"
                disabled={ocupado}
                onPress={() => {
                  Alert.alert('Cancelar pedido', 'O pedido sai da fila de recebimento.', [
                    { text: 'Voltar', style: 'cancel' },
                    {
                      text: 'Cancelar pedido',
                      style: 'destructive',
                      onPress: () => {
                        void mudarStatus('cancelado');
                      },
                    },
                  ]);
                }}
              />
            </Secao>
          ) : null}

          {pedido.status !== 'cancelado' ? (
            <Secao titulo="Registrar entrada">
              <View style={styles.linha}>
                <Campo
                  rotulo={`Quantidade (${unidade})`}
                  valor={quantidade}
                  onChange={setQuantidade}
                  numerico
                  metade
                />
                <Campo
                  rotulo="Valor unitário"
                  valor={valorUnit}
                  onChange={setValorUnit}
                  numerico
                  metade
                />
              </View>

              <View style={styles.linha}>
                <Campo rotulo="Nota fiscal" valor={notaFiscal} onChange={setNotaFiscal} metade />
                <Campo rotulo="Lote" valor={lote} onChange={setLote} metade />
              </View>

              <Campo
                rotulo="Validade (DD/MM/AAAA)"
                valor={validade}
                onChange={setValidade}
                placeholder="opcional"
              />
              <Campo rotulo="Observação" valor={observacao} onChange={setObservacao} />

              <Button
                label="Confirmar entrada no estoque"
                icon={PackageCheck}
                loading={ocupado}
                onPress={() => {
                  void registrar(true);
                }}
              />
              <Button
                label="Salvar para conferir depois"
                icon={ClipboardCheck}
                variant="secondary"
                disabled={ocupado}
                onPress={() => {
                  void registrar(false);
                }}
              />
              <Text variant="meta" color={colors.textMuted}>
                Confirmando, o saldo do produto sobe na hora e o movimento fica no histórico com o
                número do pedido.
              </Text>
            </Secao>
          ) : null}

          <Secao titulo={`Recebimentos (${recebimentos.length})`}>
            {recebimentos.length === 0 ? (
              <Text variant="meta" color={colors.textMuted}>
                Nada recebido ainda.
              </Text>
            ) : (
              recebimentos.map((r) => (
                <View key={r.id} style={styles.recebimento}>
                  <View style={styles.recebimentoTopo}>
                    <Text variant="bodyStrong">
                      {r.quantity_received} {unidade}
                    </Text>
                    <Badge
                      label={r.confirmed ? 'Confirmado' : 'A conferir'}
                      tone={r.confirmed ? 'success' : 'warning'}
                    />
                  </View>

                  <Text variant="meta" color={colors.textSecondary}>
                    {[
                      r.invoice_number ? `NF ${r.invoice_number}` : null,
                      r.batch ? `lote ${r.batch}` : null,
                      r.expires_at ? `validade ${dataCurta(r.expires_at)}` : null,
                      r.unit_price != null ? moeda(Number(r.unit_price)) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem nota informada'}
                  </Text>

                  {r.notes ? (
                    <Text variant="meta" color={colors.textMuted}>
                      {r.notes}
                    </Text>
                  ) : null}

                  <Text variant="meta" color={colors.textMuted}>
                    {dataCurta(r.confirmed_at ?? r.created_at)}
                  </Text>

                  {!r.confirmed ? (
                    <View style={styles.acoes}>
                      <View style={styles.flex}>
                        <Button
                          label="Confirmar"
                          icon={Check}
                          disabled={ocupado}
                          onPress={() => {
                            void confirmar(r.id);
                          }}
                        />
                      </View>
                      <View style={styles.flex}>
                        <Button
                          label="Apagar"
                          icon={Trash2}
                          variant="secondary"
                          disabled={ocupado}
                          onPress={() => excluir(r.id)}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </Secao>

          {fechado && pedido.status === 'recebido' ? (
            <View style={styles.encerrado}>
              <Truck size={18} color={colors.successStrong} />
              <Text variant="meta" color={colors.successStrong}>
                Pedido inteiro recebido. A solicitação de reposição foi encerrada.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {titulo}
      </Text>
      <Card style={styles.secaoCard}>{children}</Card>
    </View>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: string;
}) {
  return (
    <View style={styles.numero}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {rotulo}
      </Text>
      <Text variant="cardTitle" color={destaque ?? colors.textPrimary}>
        {valor}
      </Text>
    </View>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  numerico = false,
  metade = false,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  numerico?: boolean;
  metade?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={[styles.campo, metade && styles.flex]}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        keyboardType={numerico ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.brand}
        style={styles.input}
      />
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
    gap: spacing.lg,
  },
  flex: { flex: 1 },

  secao: { gap: spacing.md },
  secaoCard: { gap: spacing.md },
  linha: { flexDirection: 'row', gap: spacing.md },
  campo: { gap: spacing.xs },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.slate50,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },

  numeros: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  numero: { flex: 1, gap: spacing.xs },

  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate50,
  },
  pillAtiva: { backgroundColor: colors.brand, borderColor: colors.brand },

  recebimento: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  recebimentoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  acoes: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },

  encerrado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});

