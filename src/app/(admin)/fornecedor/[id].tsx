import { useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, Mail, MessageCircle, Phone, Save } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/lib/alerta';
import { fetchFornecedores, salvarFornecedor, type Fornecedor } from '@/services/estoque';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

type Form = Omit<Fornecedor, 'id'>;

const VAZIO: Form = {
  name: '',
  trade_name: null,
  doc: null,
  phone: null,
  whatsapp: null,
  email: null,
  contact_name: null,
  city: null,
  state: null,
  active: true,
};

/** Só dígitos: é assim que o wa.me espera o número. */
function digitos(v: string | null): string {
  return (v ?? '').replace(/\D/g, '');
}

export default function FornecedorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (novo) {
        setForm(VAZIO);
        return;
      }
      // A lista já traz tudo que o formulário edita; não vale uma consulta
      // dedicada para uma entidade deste tamanho.
      const todos = await fetchFornecedores();
      const achado = todos.find((f) => f.id === id);
      if (!achado) throw new Error('Fornecedor não encontrado.');
      const { id: _ignorado, ...resto } = achado;
      setForm(resto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o fornecedor.');
    } finally {
      setLoading(false);
    }
  }, [id, novo]);

  useEffect(() => {
    void load();
  }, [load]);

  function mudar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  }

  async function salvar() {
    if (!form) return;
    if (!form.name.trim()) {
      Alert.alert('Razão social obrigatória', 'Informe ao menos a razão social do fornecedor.');
      return;
    }
    if (!digitos(form.whatsapp) && !form.email) {
      Alert.alert(
        'Sem canal de contato',
        'Sem WhatsApp nem e-mail não há como enviar a solicitação de cotação. Preencha ao menos um.',
      );
      return;
    }

    setSalvando(true);
    setError(null);
    try {
      const salvo = await salvarFornecedor(novo ? null : (id ?? null), form);
      if (novo) router.replace(`/(admin)/fornecedor/${salvo}` as never);
      else Alert.alert('Salvo', 'Cadastro atualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !form) return <ErrorState message={error} onRetry={load} />;
  if (!form) return null;

  const zap = digitos(form.whatsapp);

  return (
    <View style={styles.root}>
      <Header
        title={novo ? 'Novo fornecedor' : form.trade_name || form.name || 'Fornecedor'}
        eyebrow="Estoque · Fornecedores"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Secao titulo="Empresa">
            <Campo rotulo="Razão social" valor={form.name} onChange={(v) => mudar('name', v)} />
            <Campo
              rotulo="Nome fantasia"
              valor={form.trade_name ?? ''}
              onChange={(v) => mudar('trade_name', v || null)}
            />
            <Campo
              rotulo="CNPJ"
              valor={form.doc ?? ''}
              onChange={(v) => mudar('doc', v || null)}
            />
            <View style={styles.linha}>
              <Campo
                rotulo="Cidade"
                valor={form.city ?? ''}
                onChange={(v) => mudar('city', v || null)}
                metade
              />
              <Campo
                rotulo="Estado"
                valor={form.state ?? ''}
                onChange={(v) => mudar('state', v || null)}
                metade
              />
            </View>
          </Secao>

          <Secao titulo="Contato">
            <Campo
              rotulo="Nome do contato"
              valor={form.contact_name ?? ''}
              onChange={(v) => mudar('contact_name', v || null)}
            />
            <Campo
              rotulo="WhatsApp"
              valor={form.whatsapp ?? ''}
              onChange={(v) => mudar('whatsapp', v || null)}
              teclado="phone-pad"
            />
            <Campo
              rotulo="Telefone"
              valor={form.phone ?? ''}
              onChange={(v) => mudar('phone', v || null)}
              teclado="phone-pad"
            />
            <Campo
              rotulo="E-mail"
              valor={form.email ?? ''}
              onChange={(v) => mudar('email', v || null)}
              teclado="email-address"
            />

            <Text variant="meta" color={colors.textMuted}>
              O WhatsApp é o canal que a solicitação de cotação usa. Sem ele, o botão de envio não
              aparece na solicitação.
            </Text>

            {!novo && (zap || form.phone || form.email) ? (
              <View style={styles.testes}>
                {zap ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        `https://wa.me/${zap.startsWith('55') ? zap : `55${zap}`}`,
                      ).catch(() => {})
                    }
                    style={styles.teste}>
                    <MessageCircle size={16} color={colors.successStrong} />
                    <Text variant="meta" color={colors.successStrong}>
                      Testar WhatsApp
                    </Text>
                  </Pressable>
                ) : null}
                {form.phone ? (
                  <Pressable
                    onPress={() => void Linking.openURL(`tel:${digitos(form.phone)}`).catch(() => {})}
                    style={styles.teste}>
                    <Phone size={16} color={colors.brand} />
                    <Text variant="meta" color={colors.brand}>
                      Ligar
                    </Text>
                  </Pressable>
                ) : null}
                {form.email ? (
                  <Pressable
                    onPress={() => void Linking.openURL(`mailto:${form.email}`).catch(() => {})}
                    style={styles.teste}>
                    <Mail size={16} color={colors.brand} />
                    <Text variant="meta" color={colors.brand}>
                      E-mail
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Secao>

          <Card>
            <Pressable onPress={() => mudar('active', !form.active)} style={styles.ativo}>
              <View style={[styles.caixa, form.active && styles.caixaMarcada]} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Fornecedor ativo</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  Inativar tira das listas de escolha, mas preserva o histórico de compras e
                  comunicações.
                </Text>
              </View>
            </Pressable>
          </Card>

          {error ? (
            <Card style={styles.erro}>
              <Text variant="body" color={colors.dangerStrong}>
                {error}
              </Text>
            </Card>
          ) : null}

          <Button
            label={novo ? 'Criar fornecedor' : 'Salvar alterações'}
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
      <View style={styles.secaoTitulo}>
        <Building2 size={15} color={colors.textSecondary} />
        <Text variant="microLabel" color={colors.textSecondary}>
          {titulo}
        </Text>
      </View>
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
  teclado?: 'default' | 'phone-pad' | 'email-address';
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
    maxWidth: layout.maxFormWidth,
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  flex: { flex: 1, gap: 2 },

  secao: { gap: spacing.md },
  secaoTitulo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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

  testes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  teste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  ativo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  caixa: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.slate300,
  },
  caixaMarcada: { backgroundColor: colors.brand, borderColor: colors.brand },

  erro: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
});
