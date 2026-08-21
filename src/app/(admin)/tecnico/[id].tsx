import { useLocalSearchParams, useRouter } from 'expo-router';
import { Save, UserCheck, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/lib/alerta';
import {
  ESPECIALIDADES,
  fetchPerfisDisponiveis,
  fetchTecnicos,
  promoverParaTecnico,
  ROTULO_ESPECIALIDADE,
  salvarTecnico,
  type PerfilLivre,
  type Tecnico,
} from '@/services/cadastros';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

/**
 * Matrícula é única no banco. Sem esta tradução, a pessoa recebe a
 * mensagem crua do Postgres e não faz ideia do que aconteceu.
 */
function mensagemDeErro(e: unknown): string {
  const bruta = e instanceof Error ? e.message : '';
  if (/duplicate key|unique/i.test(bruta) && /registration/i.test(bruta)) {
    return 'Já existe um técnico com esta matrícula.';
  }
  return bruta || 'Tente novamente.';
}

export default function TecnicoDetalheScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novo = id === 'novo';

  const [tecnico, setTecnico] = useState<Tecnico | null>(null);
  const [perfis, setPerfis] = useState<PerfilLivre[]>([]);
  const [perfilId, setPerfilId] = useState<string | null>(null);

  const [matricula, setMatricula] = useState('');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (novo) {
        setPerfis(await fetchPerfisDisponiveis());
      } else {
        // A equipe é pequena e a lista já vem com o perfil embutido; buscar
        // tudo e escolher evita mais uma função de serviço para um ganho
        // que ninguém sentiria.
        const t = (await fetchTecnicos()).find((x) => x.id === id) ?? null;
        if (!t) throw new Error('Técnico não encontrado.');
        setTecnico(t);
        setPerfilId(t.profile_id);
        setMatricula(t.registration ?? '');
        setEspecialidades(t.specialties);
        setAtivo(t.active);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [id, novo]);

  useEffect(() => {
    void load();
  }, [load]);

  function alternarEspecialidade(chave: string) {
    setEspecialidades((atual) =>
      atual.includes(chave) ? atual.filter((e) => e !== chave) : [...atual, chave],
    );
  }

  /** Cliente virando técnico troca de portal. Isso se pergunta antes. */
  async function escolherPerfil(p: PerfilLivre) {
    if (p.role === 'tecnico') {
      setPerfilId(p.id);
      return;
    }
    const seguir = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Mudar o acesso desta pessoa?',
        `${p.full_name || p.email || 'Esta conta'} está como cliente. Ao virar técnico, ela passa a ver as ordens de serviço e deixa de ver o portal do cliente.`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Tornar técnico', onPress: () => resolve(true) },
        ],
      );
    });
    if (seguir) setPerfilId(p.id);
  }

  async function salvar() {
    if (!perfilId) {
      Alert.alert('Escolha o perfil', 'Selecione quem será vinculado à equipe.');
      return;
    }

    setSalvando(true);
    try {
      // A promoção vem antes do vínculo: se ela falhar, ninguém fica
      // vinculado com o papel errado.
      if (novo) {
        const escolhido = perfis.find((p) => p.id === perfilId);
        if (escolhido && escolhido.role !== 'tecnico') {
          await promoverParaTecnico(perfilId);
        }
      }

      await salvarTecnico(novo ? null : (id as string), {
        profile_id: perfilId,
        registration: matricula.trim() || null,
        specialties: especialidades,
        active: ativo,
      });

      Alert.alert(novo ? 'Técnico vinculado' : 'Alterações salvas');
      router.back();
    } catch (e) {
      Alert.alert('Não foi possível salvar', mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const prontos = perfis.filter((p) => p.role === 'tecnico');
  const outros = perfis.filter((p) => p.role !== 'tecnico');

  return (
    <View style={styles.root}>
      <Header
        title={novo ? 'Vincular técnico' : tecnico?.profile?.full_name || 'Técnico'}
        eyebrow="Equipe técnica"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {novo ? (
            <Secao titulo="Quem será vinculado">
              {perfis.length === 0 ? (
                <Text variant="meta" color={colors.textSecondary}>
                  Nenhuma conta disponível. A pessoa precisa se cadastrar no aplicativo primeiro —
                  contas de administrador não aparecem aqui de propósito.
                </Text>
              ) : (
                <>
                  {prontos.length > 0 ? (
                    <>
                      <Text variant="microLabel" color={colors.textSecondary}>
                        Já são técnicos
                      </Text>
                      {prontos.map((p) => (
                        <LinhaPerfil
                          key={p.id}
                          perfil={p}
                          escolhido={perfilId === p.id}
                          onPress={() => {
                            void escolherPerfil(p);
                          }}
                        />
                      ))}
                    </>
                  ) : null}

                  {outros.length > 0 ? (
                    <>
                      <Text variant="microLabel" color={colors.textSecondary}>
                        Outras contas
                      </Text>
                      <Text variant="meta" color={colors.textMuted}>
                        Nenhum cadastro nasce como técnico. Escolher alguém daqui muda o acesso
                        dessa pessoa, e por isso a tela confirma antes.
                      </Text>
                      {outros.map((p) => (
                        <LinhaPerfil
                          key={p.id}
                          perfil={p}
                          escolhido={perfilId === p.id}
                          onPress={() => {
                            void escolherPerfil(p);
                          }}
                        />
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </Secao>
          ) : (
            <Secao titulo="Conta vinculada">
              <Text variant="cardTitle">{tecnico?.profile?.full_name || 'Sem nome'}</Text>
              <Text variant="meta" color={colors.textSecondary}>
                {tecnico?.profile?.email ?? 'Sem email'}
                {tecnico?.profile?.phone ? ` · ${tecnico.profile.phone}` : ''}
              </Text>
              <Text variant="meta" color={colors.textMuted}>
                A conta em si não se troca por aqui. Para passar a equipe para outra pessoa, inative
                este vínculo e crie um novo.
              </Text>
            </Secao>
          )}

          <Secao titulo="Dados da equipe">
            <View style={styles.campo}>
              <Text variant="microLabel" color={colors.textSecondary}>
                Matrícula
              </Text>
              <TextInput
                value={matricula}
                onChangeText={setMatricula}
                placeholder="opcional"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.brand}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>

            <View style={styles.campo}>
              <Text variant="microLabel" color={colors.textSecondary}>
                Especialidades
              </Text>
              <View style={styles.pills}>
                {ESPECIALIDADES.map((chave) => {
                  const ativa = especialidades.includes(chave);
                  return (
                    <Pressable
                      key={chave}
                      onPress={() => alternarEspecialidade(chave)}
                      style={[styles.pill, ativa && styles.pillAtiva]}>
                      <Text
                        variant="meta"
                        color={ativa ? colors.textOnBrand : colors.textSecondary}>
                        {ROTULO_ESPECIALIDADE[chave] ?? chave}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="meta" color={colors.textMuted}>
                A distribuição automática usa isto para escolher quem atende cada chamado.
              </Text>
            </View>

            <View style={styles.linhaAtivo}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Ativo na equipe</Text>
                <Text variant="meta" color={colors.textMuted}>
                  Inativo não recebe chamado novo e some do mapa, mas o histórico continua.
                </Text>
              </View>
              <Switch
                value={ativo}
                onValueChange={setAtivo}
                trackColor={{ false: colors.slate200, true: colors.success }}
                thumbColor={colors.bgSurface}
              />
            </View>
          </Secao>

          <Button
            label={novo ? 'Vincular à equipe' : 'Salvar alterações'}
            icon={novo ? UserPlus : Save}
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

function LinhaPerfil({
  perfil,
  escolhido,
  onPress,
}: {
  perfil: PerfilLivre;
  escolhido: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.perfil,
        escolhido && styles.perfilEscolhido,
        pressed && styles.pressionado,
      ]}>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {perfil.full_name || 'Sem nome'}
        </Text>
        <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
          {perfil.email ?? 'Sem email'}
        </Text>
      </View>
      {perfil.role !== 'tecnico' ? <Badge label="Cliente" tone="warning" /> : null}
      {escolhido ? <UserCheck size={18} color={colors.brand} /> : null}
    </Pressable>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  flex: { flex: 1, gap: spacing.xs },

  secao: { gap: spacing.md },
  secaoCard: { gap: spacing.md },
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

  perfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    padding: spacing.md,
  },
  perfilEscolhido: { borderColor: colors.brand, backgroundColor: colors.brandTint },

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

  linhaAtivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.md,
  },
  pressionado: { opacity: 0.85 },
});
