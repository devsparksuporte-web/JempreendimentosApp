import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownToLine, ArrowUpFromLine, Save, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  criarProduto,
  fetchFornecedores,
  fetchMovimentos,
  fetchProduto,
  movimentar,
  nivelDoProduto,
  salvarProduto,
  sugestaoDeReposicao,
  type EdicaoProduto,
  type Fornecedor,
  type Movimento,
  type TipoMovimento,
} from '@/services/estoque';
import { Alert } from '@/lib/alerta';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

const UNIDADES = ['un', 'cx', 'm', 'L', 'kg', 'pct', 'rolo', 'par'];

const ROTULO_MOVIMENTO: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  devolucao: 'Devolução',
  recebimento_compra: 'Recebimento de compra',
  uso_tecnico: 'Uso em atendimento',
};

/** Aceita vírgula decimal, que é como se digita em português. */
function paraNumero(texto: string): number | null {
  const limpo = texto.replace(',', '.').trim();
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export default function ProdutoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';

  const [form, setForm] = useState<EdicaoProduto | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Movimento em digitação. Null quando o modal está fechado. */
  const [movimento, setMovimento] = useState<{ tipo: TipoMovimento; texto: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const listaFornecedores = await fetchFornecedores();
      setFornecedores(listaFornecedores);

      if (novo) {
        setForm({
          name: '',
          code: null,
          sku: null,
          brand: null,
          model: null,
          unit: 'un',
          cost_price: null,
          sale_price: null,
          supplier_id: null,
          active: true,
          minimo: 0,
          maximo: 0,
          reposicao: null,
          localizacao: null,
        });
        setSaldo(0);
      } else if (id) {
        const p = await fetchProduto(id);
        setForm({
          name: p.name,
          code: p.code,
          sku: p.sku,
          brand: p.brand,
          model: p.model,
          unit: p.unit,
          cost_price: p.cost_price,
          sale_price: p.sale_price,
          supplier_id: p.supplier_id,
          active: p.active,
          minimo: p.minimo,
          maximo: p.maximo,
          reposicao: p.reposicao,
          localizacao: p.localizacao,
        });
        setSaldo(p.saldo);
        setMovimentos(await fetchMovimentos(id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o produto.');
    } finally {
      setLoading(false);
    }
  }, [id, novo]);

  useEffect(() => {
    void load();
  }, [load]);

  function mudar<K extends keyof EdicaoProduto>(campo: K, valor: EdicaoProduto[K]) {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  async function salvar() {
    if (!form) return;
    if (!form.name.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do produto.');
      return;
    }
    if (form.maximo > 0 && form.maximo <= form.minimo) {
      Alert.alert(
        'Máximo menor que o mínimo',
        'O estoque máximo precisa ser maior que o mínimo, senão a sugestão de reposição fica negativa.',
      );
      return;
    }

    setSalvando(true);
    setError(null);
    try {
      if (novo) {
        const criado = await criarProduto(form);
        router.replace(`/(admin)/produto/${criado}` as never);
      } else if (id) {
        await salvarProduto(id, form);
        await load();
        Alert.alert('Salvo', 'Cadastro atualizado.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  // Modal próprio em vez de Alert.prompt: aquele existe só no iOS e no
  // Android o botão não faria nada — falha silenciosa na plataforma alvo.
  function pedirMovimento(tipo: TipoMovimento) {
    if (!id || novo) return;
    setMovimento({ tipo, texto: '' });
  }

  async function confirmarMovimento() {
    if (!id || !movimento) return;
    const valor = paraNumero(movimento.texto);
    if (valor === null || valor < 0 || (movimento.tipo !== 'ajuste' && valor <= 0)) {
      Alert.alert('Quantidade inválida', 'Informe um número maior que zero.');
      return;
    }
    try {
      await movimentar({
        partId: id,
        tipo: movimento.tipo,
        quantidade: valor,
        motivo: 'Lançamento manual',
      });
      setMovimento(null);
      await load();
    } catch (e) {
      Alert.alert('Não foi possível movimentar', e instanceof Error ? e.message : '');
    }
  }

  if (loading) return <LoadingState />;
  if (error && !form) return <ErrorState message={error} onRetry={load} />;
  if (!form) return null;

  const nivel = nivelDoProduto({ saldo, minimo: form.minimo });
  const sugestao = sugestaoDeReposicao({
    saldo,
    maximo: form.maximo,
    reposicao: form.reposicao,
  });

  return (
    <View style={styles.root}>
      <Header
        title={novo ? 'Novo produto' : form.name || 'Produto'}
        eyebrow="Estoque · Cadastro"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {!novo ? (
            <Card style={nivel === 'ok' ? undefined : styles.cardAlerta}>
              <View style={styles.saldoTopo}>
                <View style={styles.flex}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Saldo atual
                  </Text>
                  <Text variant="kpi">
                    {saldo} {form.unit}
                  </Text>
                </View>
                <Badge
                  label={nivel === 'ok' ? 'Estoque OK' : nivel === 'baixo' ? 'Baixo' : 'Crítico'}
                  tone={nivel === 'ok' ? 'success' : nivel === 'baixo' ? 'warning' : 'danger'}
                />
              </View>

              <Text variant="meta" color={colors.textSecondary}>
                {form.maximo > 0
                  ? `Sugestão de reposição: ${sugestao} ${form.unit}.`
                  : 'Sem estoque máximo configurado, o sistema não sugere quantidade — e não cria solicitação.'}
              </Text>

              <View style={styles.acoesMovimento}>
                <View style={styles.flex}>
                  <Button
                    label="Entrada"
                    icon={ArrowDownToLine}
                    variant="secondary"
                    onPress={() => pedirMovimento('entrada')}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Saída"
                    icon={ArrowUpFromLine}
                    variant="secondary"
                    onPress={() => pedirMovimento('saida')}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Ajuste"
                    icon={SlidersHorizontal}
                    variant="secondary"
                    onPress={() => pedirMovimento('ajuste')}
                  />
                </View>
              </View>
            </Card>
          ) : null}

          <Secao titulo="Identificação">
            <Campo rotulo="Nome" valor={form.name} onChange={(v) => mudar('name', v)} />
            <View style={styles.linha}>
              <Campo
                rotulo="Código"
                valor={form.code ?? ''}
                onChange={(v) => mudar('code', v || null)}
                metade
              />
              <Campo
                rotulo="SKU"
                valor={form.sku ?? ''}
                onChange={(v) => mudar('sku', v || null)}
                metade
              />
            </View>
            <View style={styles.linha}>
              <Campo
                rotulo="Marca"
                valor={form.brand ?? ''}
                onChange={(v) => mudar('brand', v || null)}
                metade
              />
              <Campo
                rotulo="Modelo"
                valor={form.model ?? ''}
                onChange={(v) => mudar('model', v || null)}
                metade
              />
            </View>

            <Text variant="microLabel" color={colors.textSecondary}>
              Unidade
            </Text>
            <View style={styles.pills}>
              {UNIDADES.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => mudar('unit', u)}
                  style={[styles.pill, form.unit === u && styles.pillAtiva]}>
                  <Text variant="meta" color={form.unit === u ? colors.textOnBrand : colors.textSecondary}>
                    {u}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Secao>

          <Secao titulo="Reposição">
            <View style={styles.linha}>
              <Campo
                rotulo="Estoque mínimo"
                valor={String(form.minimo)}
                onChange={(v) => mudar('minimo', paraNumero(v) ?? 0)}
                numerico
                metade
              />
              <Campo
                rotulo="Estoque máximo"
                valor={String(form.maximo)}
                onChange={(v) => mudar('maximo', paraNumero(v) ?? 0)}
                numerico
                metade
              />
            </View>
            <Campo
              rotulo="Quantidade fixa de reposição (opcional)"
              valor={form.reposicao != null ? String(form.reposicao) : ''}
              onChange={(v) => mudar('reposicao', paraNumero(v))}
              numerico
            />
            <Text variant="meta" color={colors.textMuted}>
              Em branco, o sistema repõe até o máximo. Preenchido, sempre pede essa quantidade.
            </Text>
            <Campo
              rotulo="Localização"
              valor={form.localizacao ?? ''}
              onChange={(v) => mudar('localizacao', v || null)}
            />
          </Secao>

          <Secao titulo="Comercial">
            <View style={styles.linha}>
              <Campo
                rotulo="Custo unitário"
                valor={form.cost_price != null ? String(form.cost_price) : ''}
                onChange={(v) => mudar('cost_price', paraNumero(v))}
                numerico
                metade
              />
              <Campo
                rotulo="Preço de venda"
                valor={form.sale_price != null ? String(form.sale_price) : ''}
                onChange={(v) => mudar('sale_price', paraNumero(v))}
                numerico
                metade
              />
            </View>

            <Text variant="microLabel" color={colors.textSecondary}>
              Fornecedor principal
            </Text>
            <View style={styles.pills}>
              <Pressable
                onPress={() => mudar('supplier_id', null)}
                style={[styles.pill, form.supplier_id === null && styles.pillAtiva]}>
                <Text
                  variant="meta"
                  color={form.supplier_id === null ? colors.textOnBrand : colors.textSecondary}>
                  Nenhum
                </Text>
              </Pressable>
              {fornecedores.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => mudar('supplier_id', f.id)}
                  style={[styles.pill, form.supplier_id === f.id && styles.pillAtiva]}>
                  <Text
                    variant="meta"
                    color={form.supplier_id === f.id ? colors.textOnBrand : colors.textSecondary}>
                    {f.trade_name ?? f.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => mudar('active', !form.active)} style={styles.ativo}>
              <View style={[styles.caixa, form.active && styles.caixaMarcada]} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Produto ativo</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  Inativar preserva o histórico. Produto com movimentação não deve ser excluído.
                </Text>
              </View>
            </Pressable>
          </Secao>

          {error ? (
            <Card style={styles.erro}>
              <Text variant="body" color={colors.dangerStrong}>
                {error}
              </Text>
            </Card>
          ) : null}

          <Button
            label={novo ? 'Criar produto' : 'Salvar alterações'}
            icon={Save}
            loading={salvando}
            onPress={() => {
              void salvar();
            }}
          />

          {!novo && movimentos.length > 0 ? (
            <Secao titulo="Histórico de movimentação">
              {movimentos.map((m) => (
                <View key={m.id} style={styles.movimento}>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{ROTULO_MOVIMENTO[m.type] ?? m.type}</Text>
                    <Text variant="meta" color={colors.textSecondary}>
                      {m.reason ?? m.note ?? 'Sem observação'} ·{' '}
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                    </Text>
                  </View>
                  <View style={styles.movimentoNumeros}>
                    <Text variant="bodyStrong">{m.quantity}</Text>
                    {m.quantity_before != null && m.quantity_after != null ? (
                      <Text variant="meta" color={colors.textMuted}>
                        {m.quantity_before} → {m.quantity_after}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Secao>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={movimento !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMovimento(null)}>
        <View style={styles.fundoModal}>
          <View style={styles.modal}>
            <Text variant="screenTitle">
              {movimento ? ROTULO_MOVIMENTO[movimento.tipo] : ''}
            </Text>
            <Text variant="body" color={colors.textSecondary}>
              {movimento?.tipo === 'ajuste'
                ? 'Informe o saldo correto. O histórico guarda o valor anterior e o novo.'
                : 'Informe a quantidade a movimentar.'}
            </Text>

            <TextInput
              value={movimento?.texto ?? ''}
              onChangeText={(t) => setMovimento((m) => (m ? { ...m, texto: t } : m))}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              style={[styles.input, styles.inputModal]}
            />

            <View style={styles.acoesModal}>
              <View style={styles.flex}>
                <Button label="Cancelar" variant="secondary" onPress={() => setMovimento(null)} />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Confirmar"
                  onPress={() => {
                    void confirmarMovimento();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  flex: { flex: 1, gap: 2 },

  cardAlerta: { borderColor: colors.warning },
  saldoTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  acoesMovimento: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

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

  ativo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.slate300,
  },
  caixaMarcada: { backgroundColor: colors.brand, borderColor: colors.brand },

  movimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  movimentoNumeros: { alignItems: 'flex-end' },

  erro: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },

  fundoModal: {
    flex: 1,
    backgroundColor: 'rgba(6,21,46,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bgSurface,
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
  },
  inputModal: { fontSize: 22, minHeight: 58, textAlign: 'center' },
  acoesModal: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
