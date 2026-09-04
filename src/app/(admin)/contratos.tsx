import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarClock, FileSignature, Plus, UserRound, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { fetchClientes, type Cliente } from '@/services/cadastros';
import { emReais, fetchContratos, salvarContrato, type Contrato } from '@/services/financeiro';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

/**
 * Contratos de manutenção mensal.
 *
 * O contrato é o que alimenta o faturamento: a tela do financeiro percorre os
 * ativos e gera uma fatura por mês para cada um. Sem contrato cadastrado, o
 * botão de gerar faturas não tem o que fazer.
 *
 * `billing_day` é o dia do vencimento. Em mês curto o banco corrige sozinho —
 * dia 31 vira o último dia de fevereiro em vez de sumir.
 */

type Recorte = 'ativos' | 'encerrados' | 'todos';

function hojeISO() {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

const VAZIO = {
  client_id: '',
  description: '',
  amount: '',
  billing_day: '10',
  starts_on: hojeISO(),
  notes: '',
};

export default function ContratosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itens, setItens] = useState<Contrato[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recorte, setRecorte] = useState<Recorte>('ativos');
  const [texto, setTexto] = useState('');

  const [formAberto, setFormAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState(VAZIO);

  const carregar = useCallback(async () => {
    try {
      const [lista, cli] = await Promise.all([fetchContratos(), fetchClientes()]);
      setErro(null);
      setItens(lista);
      setClientes(cli);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os contratos.');
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

  const filtrados = useMemo(() => {
    const porRecorte = itens.filter((c) =>
      recorte === 'todos' ? true : recorte === 'ativos' ? c.active : !c.active,
    );
    const alvo = comparavel(texto);
    if (!alvo) return porRecorte;
    return porRecorte.filter((c) =>
      comparavel([c.description, c.client?.name].filter(Boolean).join(' ')).includes(alvo),
    );
  }, [itens, recorte, texto]);

  const valorValido = Number(rascunho.amount.replace(',', '.')) > 0;
  const diaValido = Number(rascunho.billing_day) >= 1 && Number(rascunho.billing_day) <= 31;
  const podeSalvar =
    rascunho.client_id !== '' &&
    rascunho.description.trim().length >= 3 &&
    valorValido &&
    diaValido;

  async function salvar() {
    if (!podeSalvar || salvando) return;
    setSalvando(true);
    try {
      await salvarContrato(null, {
        client_id: rascunho.client_id,
        description: rascunho.description.trim(),
        amount: Number(rascunho.amount.replace(',', '.')),
        billing_day: Number(rascunho.billing_day),
        starts_on: rascunho.starts_on,
        ends_on: null,
        active: true,
        notes: rascunho.notes.trim() || null,
      });
      setRascunho(VAZIO);
      setFormAberto(false);
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(c: Contrato) {
    try {
      await salvarContrato(c.id, {
        client_id: c.client_id,
        description: c.description,
        amount: Number(c.amount),
        billing_day: c.billing_day,
        starts_on: c.starts_on,
        ends_on: c.ends_on,
        active: !c.active,
        notes: c.notes,
      });
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível alterar', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }

  const colunas: Coluna<Contrato>[] = [
    {
      titulo: 'Cliente',
      peso: 1.6,
      celula: (c) => (
        <Text variant="bodyStrong" numberOfLines={1}>
          {c.client?.name ?? 'Cliente'}
        </Text>
      ),
    },
    {
      titulo: 'Descrição',
      peso: 2,
      celula: (c) => (
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {c.description}
        </Text>
      ),
    },
    {
      titulo: 'Início',
      largura: 100,
      celula: (c) => (
        <Text variant="meta" color={colors.textMuted}>
          {formatDate(c.starts_on)}
        </Text>
      ),
    },
    {
      titulo: 'Vence dia',
      largura: 86,
      celula: (c) => (
        <Text variant="meta" color={colors.textSecondary}>
          {c.billing_day}
        </Text>
      ),
    },
    {
      titulo: 'Mensal',
      largura: 112,
      aoDireita: true,
      celula: (c) => <Text variant="bodyStrong">{emReais(Number(c.amount))}</Text>,
    },
    {
      titulo: 'Situação',
      largura: 108,
      aoDireita: true,
      celula: (c) => (
        <Pressable onPress={() => void alternarAtivo(c)} accessibilityLabel="Ativar ou encerrar">
          <Badge label={c.active ? 'Ativo' : 'Encerrado'} tone={c.active ? 'success' : 'neutral'} />
        </Pressable>
      ),
    },
  ];

  return (
    <View style={styles.raiz}>
      <Header
        title="Contratos"
        eyebrow="Manutenção mensal"
        onBack={() => router.back()}
        trailing={
          <Pressable
            onPress={() => setFormAberto((a) => !a)}
            accessibilityLabel={formAberto ? 'Fechar formulário' : 'Novo contrato'}
            style={styles.botaoTopo}>
            {formAberto ? (
              <X size={18} color={colors.textSecondary} />
            ) : (
              <Plus size={18} color={colors.brand} />
            )}
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.rolagem}
        keyboardShouldPersistTaps="handled"
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
          {formAberto ? (
            <Card style={styles.form}>
              <Text variant="microLabel" color={colors.textSecondary}>
                NOVO CONTRATO
              </Text>

              <Text variant="meta" color={colors.textSecondary}>
                Cliente
              </Text>
              <View style={styles.escolhas}>
                {clientes.map((c) => {
                  const ativo = rascunho.client_id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setRascunho((r) => ({ ...r, client_id: c.id }))}
                      style={[styles.escolha, ativo && styles.escolhaAtiva]}>
                      <UserRound size={14} color={ativo ? colors.textOnBrand : colors.brand} />
                      <Text
                        variant="meta"
                        color={ativo ? colors.textOnBrand : colors.textSecondary}
                        numberOfLines={1}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Campo
                rotulo="DESCRIÇÃO"
                value={rascunho.description}
                onChangeText={(v) => setRascunho((r) => ({ ...r, description: v }))}
                placeholder="Manutenção preventiva mensal — 12 equipamentos"
              />

              <View style={styles.duplo}>
                <Campo
                  rotulo="VALOR MENSAL"
                  value={rascunho.amount}
                  onChangeText={(v) => setRascunho((r) => ({ ...r, amount: v }))}
                  placeholder="1200,00"
                  keyboardType="decimal-pad"
                  estilo={styles.flex}
                />
                <Campo
                  rotulo="VENCE DIA"
                  value={rascunho.billing_day}
                  onChangeText={(v) =>
                    setRascunho((r) => ({ ...r, billing_day: v.replace(/\D/g, '').slice(0, 2) }))
                  }
                  placeholder="10"
                  keyboardType="number-pad"
                  estilo={styles.diaCampo}
                />
              </View>

              <Campo
                rotulo="INÍCIO (AAAA-MM-DD)"
                value={rascunho.starts_on}
                onChangeText={(v) => setRascunho((r) => ({ ...r, starts_on: v }))}
                placeholder={hojeISO()}
              />

              <Campo
                rotulo="OBSERVAÇÕES"
                value={rascunho.notes}
                onChangeText={(v) => setRascunho((r) => ({ ...r, notes: v }))}
                placeholder="Opcional"
              />

              {!diaValido ? (
                <Text variant="meta" color={colors.dangerStrong}>
                  O dia do vencimento precisa estar entre 1 e 31.
                </Text>
              ) : null}

              <Button
                label="SALVAR CONTRATO"
                icon={FileSignature}
                loading={salvando}
                disabled={!podeSalvar}
                onPress={() => {
                  void salvar();
                }}
              />
            </Card>
          ) : null}

          {carregando ? (
            <LoadingState />
          ) : erro ? (
            <ErrorState message={erro} onRetry={carregar} />
          ) : (
            <>
              <Filtros
                opcoes={[
                  { chave: 'ativos', rotulo: 'Ativos' },
                  { chave: 'encerrados', rotulo: 'Encerrados' },
                  { chave: 'todos', rotulo: 'Todos' },
                ]}
                valor={recorte}
                aoTrocar={setRecorte}
                busca={{ valor: texto, aoDigitar: setTexto, dica: 'Filtrar por cliente' }}
              />

              {filtrados.length === 0 ? (
                <EmptyState
                  icon={FileSignature}
                  title={texto ? 'Nada encontrado' : 'Nenhum contrato'}
                  description={
                    texto
                      ? `Nenhum contrato combina com “${texto}”.`
                      : 'Cadastre um contrato para que o faturamento mensal tenha o que gerar.'
                  }
                />
              ) : (
                <Tabela
                  itens={filtrados}
                  colunas={colunas}
                  chave={(c) => c.id}
                  emColunas
                  cartao={(c) => (
                    <Card style={styles.cartao}>
                      <View style={styles.linhaTopo}>
                        <View style={styles.flex}>
                          <Text variant="cardTitle" numberOfLines={1}>
                            {c.client?.name ?? 'Cliente'}
                          </Text>
                          <Text variant="meta" color={colors.textSecondary} numberOfLines={2}>
                            {c.description}
                          </Text>
                        </View>
                        <Pressable onPress={() => void alternarAtivo(c)}>
                          <Badge
                            label={c.active ? 'Ativo' : 'Encerrado'}
                            tone={c.active ? 'success' : 'neutral'}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.linhaTopo}>
                        <Text variant="kpi">{emReais(Number(c.amount))}</Text>
                        <View style={styles.vencimento}>
                          <CalendarClock size={14} color={colors.textMuted} />
                          <Text variant="meta" color={colors.textMuted}>
                            Vence dia {c.billing_day}
                          </Text>
                        </View>
                      </View>
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

function Campo({
  rotulo,
  estilo,
  ...resto
}: React.ComponentProps<typeof TextInput> & { rotulo: string; estilo?: object }) {
  return (
    <View style={[styles.grupo, estilo]}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {rotulo}
      </Text>
      <TextInput placeholderTextColor={colors.textMuted} style={styles.entrada} {...resto} />
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
  botaoTopo: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
  },

  form: { gap: spacing.md },
  grupo: { gap: spacing.xs },
  duplo: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  diaCampo: { width: 108 },
  entrada: {
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  escolhas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  escolha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 260,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  escolhaAtiva: { backgroundColor: colors.brand, borderColor: colors.brand },

  cartao: { gap: spacing.md },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  vencimento: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
