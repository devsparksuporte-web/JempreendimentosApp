import { useLocalSearchParams, useRouter } from 'expo-router';
import { QrCode, Save } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  conteudoQrDoEquipamento,
  equipamentoVazio,
  fetchClientes,
  fetchEnderecos,
  fetchEquipamento,
  GASES,
  salvarEquipamento,
  TECNOLOGIAS,
  TIPOS_EQUIPAMENTO,
  type Cliente,
  type EdicaoEquipamento,
  type Endereco,
} from '@/services/cadastros';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

export default function EquipamentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, cliente } = useLocalSearchParams<{ id: string; cliente?: string }>();
  const novo = id === 'novo';

  const [form, setForm] = useState<EdicaoEquipamento | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const listaClientes = await fetchClientes();
      setClientes(listaClientes);

      if (novo) {
        const donoInicial = cliente ?? listaClientes[0]?.id ?? '';
        setForm(equipamentoVazio(donoInicial));
        if (donoInicial) setEnderecos(await fetchEnderecos(donoInicial));
      } else if (id) {
        const eq = await fetchEquipamento(id);
        const { id: _i, client: _c, ...resto } = eq;
        setForm(resto);
        setEnderecos(await fetchEnderecos(eq.client_id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o equipamento.');
    } finally {
      setLoading(false);
    }
  }, [id, novo, cliente]);

  useEffect(() => {
    void load();
  }, [load]);

  function mudar<K extends keyof EdicaoEquipamento>(campo: K, valor: EdicaoEquipamento[K]) {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  /** Trocar de cliente invalida o endereço escolhido, que é de outro dono. */
  async function trocarCliente(clientId: string) {
    mudar('client_id', clientId);
    mudar('address_id', null);
    try {
      setEnderecos(await fetchEnderecos(clientId));
    } catch {
      setEnderecos([]);
    }
  }

  async function salvar() {
    if (!form) return;
    if (!form.client_id) {
      Alert.alert('Cliente obrigatório', 'Todo equipamento pertence a um cliente.');
      return;
    }
    setSalvando(true);
    setError(null);
    try {
      const salvo = await salvarEquipamento(novo ? null : (id ?? null), form);
      if (novo) router.replace(`/(admin)/equipamento/${salvo}` as never);
      else Alert.alert('Salvo', 'Equipamento atualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !form) return <ErrorState message={error} onRetry={load} />;
  if (!form) return null;

  return (
    <View style={styles.root}>
      <Header
        title={novo ? 'Novo equipamento' : [form.brand, form.model].filter(Boolean).join(' ') || 'Equipamento'}
        eyebrow="Cadastro"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Secao titulo="Onde fica">
            <Text variant="microLabel" color={colors.textSecondary}>
              Cliente
            </Text>
            {clientes.length === 0 ? (
              <Text variant="body" color={colors.warningStrong}>
                Nenhum cliente cadastrado. Cadastre o cliente antes do equipamento.
              </Text>
            ) : (
              <View style={styles.pills}>
                {clientes.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => void trocarCliente(c.id)}
                    style={[styles.pill, form.client_id === c.id && styles.pillAtiva]}>
                    <Text
                      variant="meta"
                      color={form.client_id === c.id ? colors.textOnBrand : colors.textSecondary}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text variant="microLabel" color={colors.textSecondary}>
              Endereço
            </Text>
            {enderecos.length === 0 ? (
              <Text variant="meta" color={colors.textMuted}>
                Este cliente ainda não tem endereço. O equipamento pode ser salvo, mas o chamado
                dele não terá para onde mandar o técnico.
              </Text>
            ) : (
              <View style={styles.pills}>
                {enderecos.map((e) => (
                  <Pressable
                    key={e.id}
                    onPress={() => mudar('address_id', form.address_id === e.id ? null : e.id)}
                    style={[styles.pill, form.address_id === e.id && styles.pillAtiva]}>
                    <Text
                      variant="meta"
                      color={form.address_id === e.id ? colors.textOnBrand : colors.textSecondary}>
                      {e.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Campo
              rotulo="Ambiente"
              valor={form.environment ?? ''}
              onChange={(v) => mudar('environment', v || null)}
            />
          </Secao>

          <Secao titulo="Aparelho">
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
            <Campo
              rotulo="Número de série / patrimônio"
              valor={form.serial_number ?? ''}
              onChange={(v) => mudar('serial_number', v || null)}
            />
            <Campo
              rotulo="Capacidade (BTU)"
              valor={form.btu_capacity != null ? String(form.btu_capacity) : ''}
              onChange={(v) => {
                const n = Number(v.replace(/\D/g, ''));
                mudar('btu_capacity', v ? (Number.isFinite(n) ? n : null) : null);
              }}
              teclado="numeric"
            />

            <Escolha
              rotulo="Tipo"
              opcoes={TIPOS_EQUIPAMENTO}
              valor={form.kind}
              onChange={(v) => mudar('kind', v)}
            />
            <Escolha
              rotulo="Gás"
              opcoes={GASES}
              valor={form.gas_type}
              onChange={(v) => mudar('gas_type', v)}
            />
            <Escolha
              rotulo="Tecnologia"
              opcoes={TECNOLOGIAS}
              valor={form.technology}
              onChange={(v) => mudar('technology', v)}
            />

            <Campo
              rotulo="Observações"
              valor={form.notes ?? ''}
              onChange={(v) => mudar('notes', v || null)}
            />
          </Secao>

          {!novo && id ? (
            <Card>
              <View style={styles.qrTopo}>
                <QrCode size={22} color={colors.brand} />
                <Text variant="microLabel" color={colors.textSecondary}>
                  Etiqueta QR do aparelho
                </Text>
              </View>
              <Text variant="meta" color={colors.textMuted} style={styles.mono}>
                {conteudoQrDoEquipamento(id)}
              </Text>
              <Text variant="meta" color={colors.textSecondary}>
                Este é o conteúdo que a etiqueta deve conter. O técnico lê pelo aplicativo e abre o
                atendimento direto no equipamento certo.
              </Text>
            </Card>
          ) : null}

          {error ? (
            <Card style={styles.erro}>
              <Text variant="body" color={colors.dangerStrong}>
                {error}
              </Text>
            </Card>
          ) : null}

          <Button
            label={novo ? 'Criar equipamento' : 'Salvar alterações'}
            icon={Save}
            loading={salvando}
            onPress={() => {
              void salvar();
            }}
          />
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

function Escolha({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string;
  opcoes: string[];
  valor: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <>
      <Text variant="microLabel" color={colors.textSecondary}>
        {rotulo}
      </Text>
      <View style={styles.pills}>
        {opcoes.map((o) => (
          <Pressable
            key={o}
            onPress={() => onChange(valor === o ? null : o)}
            style={[styles.pill, valor === o && styles.pillAtiva]}>
            <Text variant="meta" color={valor === o ? colors.textOnBrand : colors.textSecondary}>
              {o}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
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
  teclado?: 'default' | 'numeric';
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

  qrTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mono: { letterSpacing: 0.4 },

  erro: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
});
