import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, Check, FileText, MessageCircle, Save, Send } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  aprovarCompra,
  atualizarReposicao,
  fetchCotacoes,
  fetchFornecedores,
  fetchReposicao,
  mensagemParaFornecedor,
  registrarCotacao,
  registrarEnvioWhatsapp,
  ROTULO_STATUS,
  type Cotacao,
  type Fornecedor,
  type Reposicao,
} from '@/services/estoque';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

function paraNumero(t: string): number {
  const n = Number(t.replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

const moeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ReposicaoDetalheScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [req, setReq] = useState<Reposicao | null>(null);
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edição da solicitação
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');

  // Formulário de cotação
  const [precoUnit, setPrecoUnit] = useState('');
  const [frete, setFrete] = useState('0');
  const [desconto, setDesconto] = useState('0');
  const [prazo, setPrazo] = useState('');
  const [pagamento, setPagamento] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [r, c, f] = await Promise.all([
        fetchReposicao(id),
        fetchCotacoes(id),
        fetchFornecedores(),
      ]);
      setReq(r);
      setCotacoes(c);
      setFornecedores(f);
      setQuantidade(String(r.quantity_requested ?? r.quantity_suggested));
      setObservacao(r.notes ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a solicitação.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function comOcupado(acao: () => Promise<void>, erroTitulo: string) {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      Alert.alert(erroTitulo, e instanceof Error ? e.message : '');
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEdicao() {
    if (!req) return;
    const qtd = paraNumero(quantidade);
    if (qtd <= 0) {
      Alert.alert('Quantidade inválida', 'Informe um número maior que zero.');
      return;
    }
    await comOcupado(async () => {
      await atualizarReposicao(req.id, {
        quantity_requested: qtd,
        notes: observacao || null,
      });
      await load();
      Alert.alert('Salvo', 'Solicitação atualizada.');
    }, 'Não foi possível salvar');
  }

  async function trocarFornecedor(supplierId: string) {
    if (!req) return;
    await comOcupado(async () => {
      await atualizarReposicao(req.id, { supplier_id: supplierId });
      await load();
    }, 'Não foi possível trocar o fornecedor');
  }

  async function enviarWhatsapp() {
    if (!req) return;
    await comOcupado(async () => {
      // O registro vem antes do envio de propósito: nenhuma mensagem sai sem
      // ficar registrada, e se o registro falhar o WhatsApp não abre.
      const link = await registrarEnvioWhatsapp(req);
      await load();
      const abriu = await Linking.canOpenURL(link);
      if (!abriu) throw new Error('Não foi possível abrir o WhatsApp neste aparelho.');
      await Linking.openURL(link);
    }, 'Não foi possível enviar');
  }

  async function salvarCotacao() {
    if (!req || !req.supplier_id) {
      Alert.alert('Sem fornecedor', 'Escolha o fornecedor antes de registrar a cotação.');
      return;
    }
    const valor = paraNumero(precoUnit);
    if (valor <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor unitário informado pelo fornecedor.');
      return;
    }
    await comOcupado(async () => {
      await registrarCotacao({
        requestId: req.id,
        supplierId: req.supplier_id!,
        quantidade: paraNumero(quantidade) || req.quantity_suggested,
        valorUnitario: valor,
        frete: paraNumero(frete),
        desconto: paraNumero(desconto),
        prazoDias: prazo ? paraNumero(prazo) : null,
        pagamento: pagamento || null,
        observacao: null,
      });
      setPrecoUnit('');
      setFrete('0');
      setDesconto('0');
      setPrazo('');
      setPagamento('');
      await load();
    }, 'Não foi possível registrar a cotação');
  }

  function aprovar(cotacao: Cotacao) {
    if (!req) return;
    Alert.alert(
      'Aprovar compra',
      `Gerar pedido de ${moeda(Number(cotacao.total_value))} para ${cotacao.supplier?.name ?? 'o fornecedor'}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: () =>
            void comOcupado(async () => {
              await aprovarCompra(req.id, cotacao.id);
              await load();
              Alert.alert('Aprovado', 'Pedido de compra gerado.');
            }, 'Não foi possível aprovar'),
        },
      ],
    );
  }

  function cancelar() {
    if (!req) return;
    Alert.alert('Cancelar solicitação', 'A solicitação será encerrada sem compra.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar solicitação',
        style: 'destructive',
        onPress: () =>
          void comOcupado(async () => {
            await atualizarReposicao(req.id, { status: 'cancelado' });
            await load();
          }, 'Não foi possível cancelar'),
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (error && !req) return <ErrorState message={error} onRetry={load} />;
  if (!req) return null;

  const encerrada = ['concluido', 'cancelado', 'recusado'].includes(req.status);
  const unidade = req.part?.unit ?? 'un';

  return (
    <View style={styles.root}>
      <Header
        title={req.number}
        eyebrow="Solicitação de reposição"
        onBack={() => router.back()}
        trailing={<Badge label={ROTULO_STATUS[req.status]} tone="info" />}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Card>
            <Text variant="microLabel" color={colors.textSecondary}>
              Produto
            </Text>
            <Text variant="screenTitle">{req.part?.name ?? 'Produto'}</Text>
            <Text variant="meta" color={colors.textSecondary}>
              Saldo {req.quantity_current} · mínimo {req.min_quantity} · máximo {req.max_quantity}
            </Text>
            <Text variant="meta" color={colors.brand}>
              Sugestão do sistema: {req.quantity_suggested} {unidade}
            </Text>
          </Card>

          {!encerrada ? (
            <Secao titulo="Ajustes do responsável">
              <Campo
                rotulo={`Quantidade a solicitar (${unidade})`}
                valor={quantidade}
                onChange={setQuantidade}
                numerico
              />
              <Campo rotulo="Observação" valor={observacao} onChange={setObservacao} />

              <Text variant="microLabel" color={colors.textSecondary}>
                Fornecedor
              </Text>
              <View style={styles.pills}>
                {fornecedores.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => void trocarFornecedor(f.id)}
                    style={[styles.pill, req.supplier_id === f.id && styles.pillAtiva]}>
                    <Text
                      variant="meta"
                      color={req.supplier_id === f.id ? colors.textOnBrand : colors.textSecondary}>
                      {f.trade_name ?? f.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {fornecedores.length === 0 ? (
                <Text variant="meta" color={colors.textMuted}>
                  Nenhum fornecedor cadastrado ainda.
                </Text>
              ) : null}

              <Button
                label="Salvar ajustes"
                icon={Save}
                variant="secondary"
                loading={ocupado}
                onPress={() => void salvarEdicao()}
              />
            </Secao>
          ) : null}

          {!encerrada && req.supplier_id ? (
            <Secao titulo="Enviar ao fornecedor">
              <Text variant="body" color={colors.textSecondary}>
                {req.supplier?.contact_name
                  ? `Contato: ${req.supplier.contact_name}`
                  : 'Sem contato nomeado'}
                {req.supplier?.whatsapp ? ` · ${req.supplier.whatsapp}` : ''}
              </Text>

              <View style={styles.previa}>
                <Text variant="meta" color={colors.textMuted}>
                  {mensagemParaFornecedor(req)}
                </Text>
              </View>

              <Button
                label="Enviar por WhatsApp"
                icon={MessageCircle}
                loading={ocupado}
                onPress={() => void enviarWhatsapp()}
              />
              <Text variant="meta" color={colors.textMuted}>
                O envio é registrado antes de abrir o WhatsApp. Nenhuma mensagem sai sem ficar no
                histórico da solicitação.
              </Text>
            </Secao>
          ) : null}

          {!encerrada ? (
            <Secao titulo="Registrar resposta do fornecedor">
              <View style={styles.linha}>
                <Campo
                  rotulo="Valor unitário"
                  valor={precoUnit}
                  onChange={setPrecoUnit}
                  numerico
                  metade
                />
                <Campo rotulo="Frete" valor={frete} onChange={setFrete} numerico metade />
              </View>
              <View style={styles.linha}>
                <Campo rotulo="Desconto" valor={desconto} onChange={setDesconto} numerico metade />
                <Campo rotulo="Prazo (dias)" valor={prazo} onChange={setPrazo} numerico metade />
              </View>
              <Campo rotulo="Condição de pagamento" valor={pagamento} onChange={setPagamento} />

              <Button
                label="Registrar cotação"
                icon={FileText}
                variant="secondary"
                loading={ocupado}
                onPress={() => void salvarCotacao()}
              />
            </Secao>
          ) : null}

          {cotacoes.length > 0 ? (
            <Secao titulo="Cotações recebidas">
              {cotacoes.map((c) => (
                <View key={c.id} style={styles.cotacao}>
                  <View style={styles.cotacaoTopo}>
                    <Text variant="bodyStrong">{c.supplier?.name ?? 'Fornecedor'}</Text>
                    <Text variant="cardTitle" color={colors.brand}>
                      {moeda(Number(c.total_value))}
                    </Text>
                  </View>
                  <Text variant="meta" color={colors.textSecondary}>
                    {c.quantity} × {moeda(Number(c.unit_price))} · frete{' '}
                    {moeda(Number(c.shipping_cost))}
                    {Number(c.discount) > 0 ? ` · desconto ${moeda(Number(c.discount))}` : ''}
                  </Text>
                  <Text variant="meta" color={colors.textMuted}>
                    {c.delivery_days ? `Entrega em ${c.delivery_days} dia(s)` : 'Prazo não informado'}
                    {c.payment_terms ? ` · ${c.payment_terms}` : ''}
                  </Text>

                  {!encerrada && req.status !== 'comprado' ? (
                    <Button
                      label="Aprovar esta cotação"
                      icon={Check}
                      loading={ocupado}
                      onPress={() => aprovar(c)}
                    />
                  ) : null}
                </View>
              ))}
            </Secao>
          ) : null}

          {!encerrada ? (
            <Button
              label="Cancelar solicitação"
              icon={Ban}
              variant="danger"
              loading={ocupado}
              onPress={cancelar}
            />
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

function Campo({
  rotulo,
  valor,
  onChange,
  numerico = false,
  metade = false,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  numerico?: boolean;
  metade?: boolean;
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

  previa: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },

  cotacao: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  cotacaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
