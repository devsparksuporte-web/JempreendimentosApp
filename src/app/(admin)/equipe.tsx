import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, HardHat, MailPlus, RefreshCw, UserPlus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  fetchTecnicos,
  ROTULO_ESPECIALIDADE,
  ROTULO_STATUS_TECNICO,
  type Tecnico,
} from '@/services/cadastros';
import { convidarAcesso } from '@/services/convites';
import { Alert } from '@/lib/alerta';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';

const TOM_STATUS: Record<Tecnico['status'], BadgeTone> = {
  disponivel: 'success',
  em_atendimento: 'info',
  a_caminho: 'warning',
  indisponivel: 'neutral',
};

export default function EquipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [emailConvite, setEmailConvite] = useState('');
  const [nomeConvite, setNomeConvite] = useState('');
  const [convidando, setConvidando] = useState(false);

  const [itens, setItens] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItens(await fetchTecnicos());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a equipe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ativos = useMemo(() => itens.filter((t) => t.active).length, [itens]);

  async function enviarConvite() {
    if (convidando) return;
    setConvidando(true);
    try {
      await convidarAcesso(emailConvite, nomeConvite);
      Alert.alert(
        'Convite enviado',
        `${emailConvite.trim().toLowerCase()} vai receber um email para definir a senha.`,
      );
      setEmailConvite('');
      setNomeConvite('');
    } catch (e) {
      Alert.alert('Não foi possível convidar', e instanceof Error ? e.message : '');
    } finally {
      setConvidando(false);
    }
  }

  return (
    <View style={styles.root}>
      <Header
        title="Equipe técnica"
        eyebrow="Cadastro e vínculos"
        onBack={() => router.back()}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar"
            onPress={load}
            style={styles.icone}>
            <RefreshCw size={18} color={colors.brand} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={styles.container}>
          <Card>
            <View style={styles.resumo}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>
                  Técnicos ativos
                </Text>
                <Text variant="kpi">{ativos}</Text>
              </View>
              <HardHat size={30} color={colors.brand} />
            </View>
            <Button
              label="Vincular técnico"
              icon={UserPlus}
              onPress={() => router.push('/(admin)/tecnico/novo' as never)}
            />
            <View style={styles.espaco} />
            <Text variant="meta" color={colors.textMuted}>
              O vínculo é feito sobre uma conta que já existe. Se a pessoa ainda não tem conta,
              convide abaixo: ela recebe um email, define a própria senha e aparece na lista de
              vínculo.
            </Text>
          </Card>

          <Card>
            <View style={styles.resumo}>
              <View style={styles.flex}>
                <Text variant="microLabel" color={colors.textSecondary}>
                  Convidar para a equipe
                </Text>
                <Text variant="meta" color={colors.textMuted}>
                  A conta nasce como cliente. Depois de aceitar, use Vincular técnico.
                </Text>
              </View>
              <MailPlus size={26} color={colors.brand} />
            </View>
            <TextInput
              value={nomeConvite}
              onChangeText={setNomeConvite}
              placeholder="Nome (opcional)"
              placeholderTextColor={colors.textMuted}
              style={styles.campo}
            />
            <TextInput
              value={emailConvite}
              onChangeText={setEmailConvite}
              placeholder="email@empresa.com.br"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.campo}
            />
            <Button
              label="Enviar convite"
              icon={MailPlus}
              loading={convidando}
              disabled={!emailConvite.includes('@')}
              onPress={() => {
                void enviarConvite();
              }}
            />
          </Card>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : itens.length === 0 ? (
            <EmptyState
              icon={HardHat}
              title="Nenhum técnico vinculado"
              description="Peça para a pessoa criar a conta no aplicativo e depois use Vincular técnico."
            />
          ) : (
            itens.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/(admin)/tecnico/${t.id}` as never)}
                style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
                <View style={styles.flex}>
                  <View style={styles.itemTopo}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {t.profile?.full_name || 'Sem nome'}
                    </Text>
                    <Badge label={ROTULO_STATUS_TECNICO[t.status]} tone={TOM_STATUS[t.status]} />
                    {!t.active ? <Badge label="Inativo" tone="neutral" /> : null}
                  </View>

                  <Text variant="meta" color={colors.textSecondary}>
                    {t.registration ? `Matrícula ${t.registration}` : 'Sem matrícula'}
                    {t.profile?.email ? ` · ${t.profile.email}` : ''}
                  </Text>

                  <Text variant="meta" color={colors.textMuted} numberOfLines={1}>
                    {t.specialties.length > 0
                      ? t.specialties.map((e) => ROTULO_ESPECIALIDADE[e] ?? e).join(' · ')
                      : 'Sem especialidade informada'}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.slate300} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  campo: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    backgroundColor: colors.bgSurface,
  },
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  flex: { flex: 1, gap: spacing.xs },

  resumo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  espaco: { height: spacing.sm },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },

  icone: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.85, transform: [{ scale: 0.995 }] },
});
