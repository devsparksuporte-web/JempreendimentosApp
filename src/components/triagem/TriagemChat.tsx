import { useRouter } from 'expo-router';
import { Camera, Send, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { equipmentName } from '@/lib/format';
import {
  buildTriagemResult,
  buildTriagemSteps,
  SAUDACAO,
  type TriagemAnswers,
  type TriagemOption,
} from '@/services/ai';
import { createServiceCallFromTriage, fetchClienteHome, type ClienteHome } from '@/services/client';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

type Bubble = { id: string; author: 'ia' | 'cliente'; text: string };

export function TriagemChat({ bottomInset = 0 }: { bottomInset?: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [home, setHome] = useState<ClienteHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [answers, setAnswers] = useState<TriagemAnswers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const equipamentoOptions = useMemo<TriagemOption[]>(
    () =>
      (home?.equipment ?? []).map((e) => ({
        value: e.id,
        label: `${equipmentName(e)}${e.environment ? ` — ${e.environment}` : ''}`,
      })),
    [home],
  );

  const steps = useMemo(() => buildTriagemSteps(equipamentoOptions), [equipamentoOptions]);
  const currentStep = stepIndex < steps.length ? steps[stepIndex] : null;
  const finished = stepIndex >= steps.length;

  useEffect(() => {
    let active = true;
    fetchClienteHome()
      .then((d) => {
        if (active) setHome(d);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar seus dados.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Abre a conversa com a saudação e a primeira pergunta.
  useEffect(() => {
    if (loading || error || bubbles.length > 0 || steps.length === 0) return;
    setBubbles([
      { id: 'saudacao', author: 'ia', text: SAUDACAO },
      { id: 'q-0', author: 'ia', text: steps[0].question },
    ]);
  }, [loading, error, bubbles.length, steps]);

  const answer = useCallback(
    (value: string, label: string) => {
      if (!currentStep) return;

      const next = { ...answers, [currentStep.id]: value };
      setAnswers(next);

      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setDraft('');

      setBubbles((prev) => [
        ...prev,
        { id: `a-${currentStep.id}`, author: 'cliente', text: label },
        ...(nextIndex < steps.length
          ? [{ id: `q-${nextIndex}`, author: 'ia' as const, text: steps[nextIndex].question }]
          : [
              {
                id: 'fim',
                author: 'ia' as const,
                text:
                  'Obrigado! Montei o resumo abaixo para o técnico. ' +
                  'Confira e toque em Criar chamado.',
              },
            ]),
      ]);
    },
    [answers, currentStep, stepIndex, steps],
  );

  const equipamentoLabel = useMemo(() => {
    const id = answers.equipamento;
    if (!id) return null;
    return equipamentoOptions.find((o) => o.value === id)?.label ?? null;
  }, [answers.equipamento, equipamentoOptions]);

  const result = useMemo(
    () => (finished ? buildTriagemResult(answers, equipamentoLabel) : null),
    [finished, answers, equipamentoLabel],
  );

  async function handleCreate() {
    if (!result || !home?.client) return;
    setCreating(true);
    setError(null);
    try {
      const call = await createServiceCallFromTriage({
        clientId: home.client.id,
        equipmentId: answers.equipamento ?? null,
        addressId: home.equipment.find((e) => e.id === answers.equipamento)?.address_id ?? null,
        title: result.title,
        description: result.description,
        aiSummary: result.summary,
      });
      router.replace(`/chamado/${call.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o chamado.');
      setCreating(false);
    }
  }

  if (loading) return <LoadingState label="Preparando a triagem…" />;
  if (error && !home) return <ErrorState message={error} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 56}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {bubbles.map((b) =>
            b.author === 'ia' ? (
              <View key={b.id} style={styles.iaRow}>
                <View style={styles.iaAvatar}>
                  <Sparkles size={16} color={colors.textOnBrand} />
                </View>
                <View style={styles.iaBubble}>
                  <Text variant="body" color={colors.textPrimary}>
                    {b.text}
                  </Text>
                </View>
              </View>
            ) : (
              <View key={b.id} style={styles.clienteRow}>
                <View style={styles.clienteBubble}>
                  <Text variant="body" color={colors.textOnBrand}>
                    {b.text}
                  </Text>
                </View>
              </View>
            ),
          )}

          {currentStep ? (
            <View style={styles.chips}>
              {currentStep.options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => answer(o.value, o.label)}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                  <Text variant="bodyStrong" color={colors.textPrimary}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {result ? (
            <Card accentBorder={colors.aiBorder} style={styles.resumo}>
              <View style={styles.resumoHeader}>
                <Sparkles size={16} color={colors.ai} />
                <Text variant="microLabel" color={colors.aiStrong}>
                  Resumo para o técnico
                </Text>
              </View>

              <ResumoLinha rotulo="Equipamento" valor={result.summary.equipamento} />
              <ResumoLinha rotulo="Sintoma" valor={result.summary.sintoma} />
              <ResumoLinha rotulo="Início" valor={result.summary.inicio} />
              <ResumoLinha rotulo="Código de erro" valor={result.summary.codigo_erro} ultima />

              <View style={styles.resumoAcao}>
                <Button
                  label={creating ? 'Criando…' : 'Criar chamado'}
                  onPress={handleCreate}
                  loading={creating}
                />
              </View>
            </Card>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text variant="body" color={colors.dangerStrong}>
                {error}
              </Text>
            </View>
          ) : null}

        </View>
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: spacing.md + bottomInset + insets.bottom }]}>
        <View style={styles.composerInner}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Anexar foto"
            style={({ pressed }) => [styles.composerIcon, pressed && styles.chipPressed]}>
            <Camera size={20} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.campo}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                currentStep?.allowFreeText ? 'Escreva sua mensagem' : 'Escolha uma opção acima'
              }
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              editable={Boolean(currentStep?.allowFreeText)}
              onSubmitEditing={() => draft.trim() && answer(draft.trim(), draft.trim())}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              disabled={!draft.trim() || !currentStep?.allowFreeText}
              onPress={() => draft.trim() && answer(draft.trim(), draft.trim())}
              style={({ pressed }) => [
                styles.sendButton,
                (!draft.trim() || !currentStep?.allowFreeText) && styles.sendDisabled,
                pressed && styles.chipPressed,
              ]}>
              <Send size={18} color={colors.textOnBrand} />
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ResumoLinha({
  rotulo,
  valor,
  ultima = false,
}: {
  rotulo: string;
  valor: string;
  /** A ultima linha nao leva filete — o CTA vem logo abaixo. */
  ultima?: boolean;
}) {
  return (
    <View style={[styles.resumoLinha, !ultima && styles.resumoLinhaFilete]}>
      <Text variant="meta" color={colors.textSecondary}>
        {rotulo}
      </Text>
      <Text variant="bodyStrong" style={styles.resumoValor} numberOfLines={2}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  iaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iaAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.ai,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Os baloes tem o canto de cima recortado do lado de quem fala — o da IA
  // a esquerda, o do cliente a direita. E o que da a direcao da conversa.
  iaBubble: {
    flex: 1,
    backgroundColor: colors.aiSoft,
    borderWidth: 1,
    borderColor: colors.aiBorder,
    borderRadius: radius.lg,
    borderTopLeftRadius: 0,
    padding: spacing.lg,
  },
  clienteRow: { alignItems: 'flex-end' },
  clienteBubble: {
    maxWidth: '85%',
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    borderTopRightRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: touch.minTarget - 8,
    justifyContent: 'center',
  },
  chipPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  resumo: { gap: spacing.md, marginTop: spacing.sm, borderRadius: radius.xl },
  resumoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resumoLinha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  resumoLinhaFilete: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  resumoValor: { flex: 1, textAlign: 'right' },
  resumoAcao: { marginTop: spacing.sm },

  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  composer: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  composerInner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  composerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campo: { flex: 1, justifyContent: 'center' },
  input: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate50,
    borderRadius: radius.lg,
    paddingLeft: spacing.lg,
    // Espaco para o botao de enviar, que fica sobreposto a direita.
    paddingRight: 52,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  sendButton: {
    position: 'absolute',
    right: 4,
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
