import { useLocalSearchParams, useRouter } from 'expo-router';
import { AirVent, Link2 as LinkIcon, MapPin, Plus, Save, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  CLIENTE_VAZIO,
  buscarCep,
  ENDERECO_VAZIO,
  fetchPerfisParaCliente,
  vincularContaDoCliente,
  type PerfilLivre,
  excluirEndereco,
  fetchCliente,
  fetchEnderecos,
  fetchEquipamentos,
  salvarCliente,
  salvarEndereco,
  type EdicaoCliente,
  type EdicaoEndereco,
  type Endereco,
  type Equipamento,
} from '@/services/cadastros';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

export default function ClienteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';

  const [form, setForm] = useState<EdicaoCliente | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Endereço em edição. Null quando o modal está fechado. */
  const [endereco, setEndereco] = useState<{ id: string | null; dados: EdicaoEndereco } | null>(
    null,
  );
  const [buscandoCep, setBuscandoCep] = useState(false);

  /** Conta de acesso ligada a este cadastro, e as candidatas livres. */
  const [contaId, setContaId] = useState<string | null>(null);
  const [contas, setContas] = useState<PerfilLivre[]>([]);
  const [ligando, setLigando] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (novo) {
        setForm({ ...CLIENTE_VAZIO });
        return;
      }
      if (!id) return;
      const [c, e, eq] = await Promise.all([
        fetchCliente(id),
        fetchEnderecos(id),
        fetchEquipamentos(id),
      ]);
      const { id: _i, profile_id: _p, ...resto } = c;
      setForm(resto);
      setContaId(c.profile_id);
      setContas(await fetchPerfisParaCliente());
      setEnderecos(e);
      setEquipamentos(eq);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o cliente.');
    } finally {
      setLoading(false);
    }
  }, [id, novo]);

  useEffect(() => {
    void load();
  }, [load]);

  function mudar<K extends keyof EdicaoCliente>(campo: K, valor: EdicaoCliente[K]) {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  async function salvar() {
    if (!form) return;
    if (!form.name.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do cliente.');
      return;
    }
    setSalvando(true);
    setError(null);
    try {
      const salvo = await salvarCliente(novo ? null : (id ?? null), form);
      if (novo) router.replace(`/(admin)/cliente/${salvo}` as never);
      else {
        await load();
        Alert.alert('Salvo', 'Cadastro atualizado.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  /**
   * Preenche rua, bairro, cidade e estado pelo CEP.
   *
   * Número e complemento continuam na mão — o CEP não os conhece. E o que já
   * estiver digitado não é sobrescrito por vazio: CEP de logradouro único
   * volta sem rua, e apagar o que a pessoa escreveu seria pior que não buscar.
   */
  async function preencherPeloCep() {
    if (!endereco) return;
    const cep = endereco.dados.zip_code ?? '';
    if (cep.replace(/\D/g, '').length !== 8) {
      Alert.alert('CEP incompleto', 'Informe os oito dígitos do CEP.');
      return;
    }

    setBuscandoCep(true);
    try {
      const achado = await buscarCep(cep);
      if (!achado) {
        Alert.alert(
          'CEP não encontrado',
          'Verifique o número ou preencha o endereço manualmente.',
        );
        return;
      }
      setEndereco((a) =>
        a
          ? {
              ...a,
              dados: {
                ...a.dados,
                street: achado.street || a.dados.street,
                district: achado.district || a.dados.district,
                city: achado.city || a.dados.city,
                state: achado.state || a.dados.state,
              },
            }
          : a,
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  /**
   * Liga a conta de acesso ao cadastro, ou desfaz a ligação.
   *
   * É o que faz `my_client_id()` encontrar este cliente. Enquanto não
   * houver conta ligada, a pessoa entra no aplicativo e não vê chamado,
   * equipamento nem laudo — o cadastro serve só para a administração.
   */
  async function ligarConta(profileId: string | null) {
    if (!id || novo) return;
    setLigando(true);
    try {
      await vincularContaDoCliente(id, profileId);
      setContaId(profileId);
      setContas(await fetchPerfisParaCliente());
    } catch (e) {
      Alert.alert('Não foi possível vincular', e instanceof Error ? e.message : '');
    } finally {
      setLigando(false);
    }
  }

  async function confirmarEndereco() {
    if (!endereco || !id || novo) return;
    if (!endereco.dados.street.trim() || !endereco.dados.city.trim()) {
      Alert.alert('Endereço incompleto', 'Rua e cidade são obrigatórias para a rota funcionar.');
      return;
    }
    try {
      await salvarEndereco(endereco.id, id, endereco.dados);
      // Recarrega ANTES de fechar. Fechando primeiro, o mesmo toque que
      // salvou atravessa para o cartão que surge embaixo e reabre a edição —
      // parece que nada foi salvo.
      const atualizados = await fetchEnderecos(id);
      setEnderecos(atualizados);
      setEndereco(null);
    } catch (e) {
      Alert.alert('Não foi possível salvar o endereço', e instanceof Error ? e.message : '');
    }
  }

  function apagarEndereco(e: Endereco) {
    Alert.alert('Excluir endereço', `Remover "${e.label}"?`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluirEndereco(e.id);
            if (id) setEnderecos(await fetchEnderecos(id));
          } catch (err) {
            Alert.alert('Não foi possível excluir', err instanceof Error ? err.message : '');
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (error && !form) return <ErrorState message={error} onRetry={load} />;
  if (!form) return null;

  return (
    <View style={styles.root}>
      <Header
        title={novo ? 'Novo cliente' : form.name || 'Cliente'}
        eyebrow="Cadastro"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Secao titulo="Dados do cliente">
            <Campo rotulo="Nome" valor={form.name} onChange={(v) => mudar('name', v)} />

            <Text variant="microLabel" color={colors.textSecondary}>
              Tipo de documento
            </Text>
            <View style={styles.pills}>
              {(['cpf', 'cnpj'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => mudar('doc_type', form.doc_type === t ? null : t)}
                  style={[styles.pill, form.doc_type === t && styles.pillAtiva]}>
                  <Text
                    variant="meta"
                    color={form.doc_type === t ? colors.textOnBrand : colors.textSecondary}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Campo
              rotulo="Documento"
              valor={form.doc ?? ''}
              onChange={(v) => mudar('doc', v || null)}
              teclado="numeric"
            />
            <View style={styles.linha}>
              <Campo
                rotulo="Telefone"
                valor={form.phone ?? ''}
                onChange={(v) => mudar('phone', v || null)}
                teclado="phone-pad"
                metade
              />
              <Campo
                rotulo="WhatsApp"
                valor={form.whatsapp ?? ''}
                onChange={(v) => mudar('whatsapp', v || null)}
                teclado="phone-pad"
                metade
              />
            </View>
            <Campo
              rotulo="E-mail"
              valor={form.email ?? ''}
              onChange={(v) => mudar('email', v || null)}
              teclado="email-address"
            />
            <Campo
              rotulo="Observações"
              valor={form.notes ?? ''}
              onChange={(v) => mudar('notes', v || null)}
            />

            <Pressable onPress={() => mudar('active', !form.active)} style={styles.ativo}>
              <View style={[styles.caixa, form.active && styles.caixaMarcada]} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Cliente ativo</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  Inativar preserva o histórico de chamados e equipamentos.
                </Text>
              </View>
            </Pressable>
          </Secao>

          {!novo ? (
            <Secao titulo="Conta de acesso">
              {contaId ? (
                <>
                  <Text variant="bodyStrong">
                    {contas.find((c) => c.id === contaId)?.full_name ??
                      'Conta ligada a este cadastro'}
                  </Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    Esta pessoa entra no aplicativo e enxerga os chamados, equipamentos e laudos
                    deste cliente — e de mais ninguém.
                  </Text>
                  <Button
                    label="Desvincular conta"
                    variant="secondary"
                    disabled={ligando}
                    onPress={() => {
                      Alert.alert(
                        'Desvincular conta',
                        'A pessoa continua com login, mas deixa de enxergar este cliente.',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Desvincular',
                            style: 'destructive',
                            onPress: () => {
                              void ligarConta(null);
                            },
                          },
                        ],
                      );
                    }}
                  />
                </>
              ) : (
                <>
                  <Text variant="meta" color={colors.textSecondary}>
                    Este cadastro ainda não tem acesso. A senha não se cria por aqui: a pessoa se
                    cadastra sozinha no aplicativo, em "Cadastre-se", e você liga a conta dela a
                    este cliente. Assim ninguém além dela conhece a própria senha.
                  </Text>

                  {contas.length === 0 ? (
                    <Text variant="meta" color={colors.textMuted}>
                      Nenhuma conta disponível no momento. Peça para a pessoa se cadastrar com o
                      email dela e atualize esta tela.
                    </Text>
                  ) : (
                    contas.map((c) => (
                      <Pressable
                        key={c.id}
                        disabled={ligando}
                        onPress={() => {
                          void ligarConta(c.id);
                        }}
                        style={({ pressed }) => [styles.conta, pressed && styles.pressionado]}>
                        <View style={styles.flex}>
                          <Text variant="bodyStrong" numberOfLines={1}>
                            {c.full_name || 'Sem nome'}
                          </Text>
                          <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                            {c.email ?? 'Sem email'}
                          </Text>
                        </View>
                        <LinkIcon size={17} color={colors.brand} />
                      </Pressable>
                    ))
                  )}
                </>
              )}
            </Secao>
          ) : null}

          {error ? (
            <Card style={styles.erro}>
              <Text variant="body" color={colors.dangerStrong}>
                {error}
              </Text>
            </Card>
          ) : null}

          <Button
            label={novo ? 'Criar cliente' : 'Salvar alterações'}
            icon={Save}
            loading={salvando}
            onPress={() => {
              void salvar();
            }}
          />

          {novo ? (
            <Text variant="meta" color={colors.textMuted} style={styles.centro}>
              Endereços e equipamentos são cadastrados depois que o cliente existir.
            </Text>
          ) : (
            <>
              <View style={styles.secao}>
                <View style={styles.secaoTopo}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Endereços
                  </Text>
                  <Pressable
                    onPress={() => setEndereco({ id: null, dados: { ...ENDERECO_VAZIO } })}
                    style={styles.iconePequeno}>
                    <Plus size={16} color={colors.brand} />
                  </Pressable>
                </View>

                {enderecos.length === 0 ? (
                  <Card>
                    <Text variant="body" color={colors.textSecondary}>
                      Nenhum endereço. Sem ele, o chamado deste cliente não tem para onde mandar o
                      técnico.
                    </Text>
                  </Card>
                ) : (
                  enderecos.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() =>
                        setEndereco({
                          id: e.id,
                          dados: {
                            label: e.label,
                            street: e.street,
                            number: e.number,
                            complement: e.complement,
                            district: e.district,
                            city: e.city,
                            state: e.state,
                            zip_code: e.zip_code,
                            is_primary: e.is_primary,
                          },
                        })
                      }
                      style={({ pressed }) => [styles.linhaItem, pressed && styles.pressionado]}>
                      <MapPin size={18} color={colors.brand} />
                      <View style={styles.flex}>
                        <View style={styles.itemTopo}>
                          <Text variant="bodyStrong">{e.label}</Text>
                          {e.is_primary ? <Badge label="Principal" tone="info" /> : null}
                        </View>
                        <Text variant="meta" color={colors.textSecondary} numberOfLines={2}>
                          {[e.street, e.number, e.district, e.city, e.state]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      </View>
                      <Pressable onPress={() => apagarEndereco(e)} hitSlop={10}>
                        <Trash2 size={16} color={colors.dangerStrong} />
                      </Pressable>
                    </Pressable>
                  ))
                )}
              </View>

              <View style={styles.secao}>
                <View style={styles.secaoTopo}>
                  <Text variant="microLabel" color={colors.textSecondary}>
                    Equipamentos
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/(admin)/equipamento/novo?cliente=${id}` as never)}
                    style={styles.iconePequeno}>
                    <Plus size={16} color={colors.brand} />
                  </Pressable>
                </View>

                {equipamentos.length === 0 ? (
                  <Card>
                    <Text variant="body" color={colors.textSecondary}>
                      Nenhum equipamento cadastrado para este cliente.
                    </Text>
                  </Card>
                ) : (
                  equipamentos.map((eq) => (
                    <Pressable
                      key={eq.id}
                      onPress={() => router.push(`/(admin)/equipamento/${eq.id}` as never)}
                      style={({ pressed }) => [styles.linhaItem, pressed && styles.pressionado]}>
                      <AirVent size={18} color={colors.brand} />
                      <View style={styles.flex}>
                        <Text variant="bodyStrong">
                          {[eq.brand, eq.model].filter(Boolean).join(' ') || 'Equipamento'}
                        </Text>
                        <Text variant="meta" color={colors.textSecondary}>
                          {[eq.environment, eq.btu_capacity ? `${eq.btu_capacity} BTU` : null, eq.gas_type]
                            .filter(Boolean)
                            .join(' · ') || 'Sem detalhes'}
                        </Text>
                      </View>
                      {!eq.active ? <Badge label="Inativo" tone="neutral" /> : null}
                    </Pressable>
                  ))
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={endereco !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEndereco(null)}>
        <View style={styles.fundoModal}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text variant="screenTitle">
                {endereco?.id ? 'Editar endereço' : 'Novo endereço'}
              </Text>

              {endereco ? (
                <>
                  <Campo
                    rotulo="Identificação"
                    valor={endereco.dados.label}
                    onChange={(v) =>
                      setEndereco((a) => (a ? { ...a, dados: { ...a.dados, label: v } } : a))
                    }
                  />

                  {/* O CEP vem primeiro de propósito: preenchido ele resolve
                      rua, bairro, cidade e estado de uma vez. */}
                  <View style={styles.linhaCep}>
                    <Campo
                      rotulo="CEP"
                      valor={endereco.dados.zip_code ?? ''}
                      onChange={(v) =>
                        setEndereco((a) =>
                          a ? { ...a, dados: { ...a.dados, zip_code: v || null } } : a,
                        )
                      }
                      teclado="numeric"
                      metade
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Buscar endereço pelo CEP"
                      onPress={() => {
                        void preencherPeloCep();
                      }}
                      disabled={buscandoCep}
                      style={({ pressed }) => [styles.botaoCep, pressed && styles.pressionado]}>
                      {buscandoCep ? (
                        <ActivityIndicator size="small" color={colors.textOnBrand} />
                      ) : (
                        <>
                          <Search size={16} color={colors.textOnBrand} />
                          <Text variant="meta" color={colors.textOnBrand}>
                            Buscar
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  <Campo
                    rotulo="Rua"
                    valor={endereco.dados.street}
                    onChange={(v) =>
                      setEndereco((a) => (a ? { ...a, dados: { ...a.dados, street: v } } : a))
                    }
                  />
                  <View style={styles.linha}>
                    <Campo
                      rotulo="Número"
                      valor={endereco.dados.number ?? ''}
                      onChange={(v) =>
                        setEndereco((a) =>
                          a ? { ...a, dados: { ...a.dados, number: v || null } } : a,
                        )
                      }
                      metade
                    />
                    <Campo
                      rotulo="Complemento"
                      valor={endereco.dados.complement ?? ''}
                      onChange={(v) =>
                        setEndereco((a) =>
                          a ? { ...a, dados: { ...a.dados, complement: v || null } } : a,
                        )
                      }
                      metade
                    />
                  </View>
                  <Campo
                    rotulo="Bairro"
                    valor={endereco.dados.district ?? ''}
                    onChange={(v) =>
                      setEndereco((a) =>
                        a ? { ...a, dados: { ...a.dados, district: v || null } } : a,
                      )
                    }
                  />
                  <View style={styles.linha}>
                    <Campo
                      rotulo="Cidade"
                      valor={endereco.dados.city}
                      onChange={(v) =>
                        setEndereco((a) => (a ? { ...a, dados: { ...a.dados, city: v } } : a))
                      }
                      metade
                    />
                    <Campo
                      rotulo="Estado"
                      valor={endereco.dados.state ?? ''}
                      onChange={(v) =>
                        setEndereco((a) =>
                          a ? { ...a, dados: { ...a.dados, state: v || null } } : a,
                        )
                      }
                      metade
                    />
                  </View>
                  <Pressable
                    onPress={() =>
                      setEndereco((a) =>
                        a ? { ...a, dados: { ...a.dados, is_primary: !a.dados.is_primary } } : a,
                      )
                    }
                    style={styles.ativo}>
                    <View style={[styles.caixa, endereco.dados.is_primary && styles.caixaMarcada]} />
                    <Text variant="body" style={styles.flex}>
                      Endereço principal — é o que a rota do técnico usa por padrão.
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <View style={styles.acoesModal}>
                <View style={styles.flex}>
                  <Button label="Cancelar" variant="secondary" onPress={() => setEndereco(null)} />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Salvar"
                    onPress={() => {
                      void confirmarEndereco();
                    }}
                  />
                </View>
              </View>
            </View>
          </ScrollView>
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
  teclado = 'default',
  metade = false,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  teclado?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
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
        keyboardType={teclado}
        autoCapitalize={teclado === 'email-address' ? 'none' : 'sentences'}
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
  conta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    padding: spacing.md,
  },
  centro: { textAlign: 'center' },

  secao: { gap: spacing.md },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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

  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate50,
  },
  pillAtiva: { backgroundColor: colors.brand, borderColor: colors.brand },

  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  ativo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.slate300,
  },
  caixaMarcada: { backgroundColor: colors.brand, borderColor: colors.brand },

  iconePequeno: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fundoModal: { flex: 1, backgroundColor: 'rgba(6,21,46,0.55)' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: layout.screenPadding },
  modal: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.md,
  },
  acoesModal: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  linhaCep: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' },
  botaoCep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },

  erro: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  pressionado: { opacity: 0.85, transform: [{ scale: 0.995 }] },
});
