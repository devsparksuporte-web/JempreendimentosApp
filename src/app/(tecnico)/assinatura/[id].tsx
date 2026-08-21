import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CheckCircle2, ChevronLeft, ClipboardCheck, RotateCcw, UserCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/lib/alerta';
import { supabase } from '@/lib/supabase';
import {
  fetchServicePhotos,
  fetchTechnicianCall,
  type TechnicianCall,
  type TechnicianPhoto,
} from '@/services/technician';
import { colors, elevation, layout, radius, spacing } from '@/theme/tokens';

export default function DigitalSignatureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [call, setCall] = useState<TechnicianCall | null>(null);
  const [photos, setPhotos] = useState<TechnicianPhoto[]>([]);
  const [strokes, setStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [terms, setTerms] = useState(false);
  const [signerName] = useState('Cliente do atendimento');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, p] = await Promise.all([fetchTechnicianCall(id), fetchServicePhotos(id)]);
      setCall(c);
      setPhotos(p);
    } catch {
      // A tela funciona sem o contexto: a assinatura é o que importa aqui.
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(
    () =>
      strokes.map((stroke) =>
        stroke.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '),
      ),
    [strokes],
  );

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) =>
      setStrokes((value) => [
        ...value,
        [{ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }],
      ]),
    onPanResponderMove: (event) =>
      setStrokes((value) => {
        if (!value.length) return value;
        const next = [...value];
        const last = next[next.length - 1];
        next[next.length - 1] = [
          ...last,
          { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY },
        ];
        return next;
      }),
  });

  function imageUri(path: string) {
    return supabase.storage.from('service-photos').getPublicUrl(path).data.publicUrl;
  }

  const antes = photos.find((p) => p.stage === 'antes');
  const depois = photos.find((p) => p.stage === 'depois');

  async function confirm() {
    if (!id) return;
    if (!terms) {
      Alert.alert(
        'Aceite necessário',
        'Confirme que o serviço foi realizado conforme a ordem de serviço.',
      );
      return;
    }
    if (!strokes.length) {
      Alert.alert('Assinatura necessária', 'Desenhe a assinatura antes de confirmar.');
      return;
    }
    setLoading(true);
    try {
      const path = `signatures/${id}/${Date.now()}.json`;
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(path, JSON.stringify({ strokes, signerName, signedAt: new Date().toISOString() }), {
          contentType: 'application/json',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { error } = await (supabase as any).from('signatures').upsert(
        {
          service_call_id: id,
          signer_name: signerName,
          storage_path: path,
          technician_id: null,
          signed_at: new Date().toISOString(),
        },
        { onConflict: 'service_call_id' },
      );
      if (error) throw error;

      Alert.alert('Assinatura confirmada', 'A ordem de serviço recebeu a assinatura digital.', [
        { text: 'Concluir', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Não foi possível salvar',
        err instanceof Error ? err.message : 'Verifique a configuração do Storage de assinaturas.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ChevronLeft size={21} color={colors.textMuted} />
        </Pressable>

        <View style={styles.headerTitulo}>
          <Text variant="microLabel" color={colors.textSecondary}>
            {call ? `Chamado #${call.code}` : 'Chamado'}
          </Text>
          <Text variant="screenTitle" style={styles.caixaAlta}>
            Serviço concluído
          </Text>
        </View>

        <View style={styles.headerIcone}>
          <CheckCircle2 size={20} color={colors.brand} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}>
        {/* Resumo do estado: fecha o assunto antes de pedir a assinatura. */}
        <View style={styles.cartaoCentrado}>
          <View style={styles.iconeGrande}>
            <ClipboardCheck size={28} color={colors.brand} />
          </View>
          <Text variant="screenTitle" style={[styles.centro, styles.caixaAlta]}>
            Ordem de serviço finalizada
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.centro}>
            O atendimento foi documentado e encerrado conforme os protocolos técnicos.
          </Text>
        </View>

        {/* Evidências lado a lado: o antes esmaecido, o depois em destaque. */}
        {antes || depois ? (
          <View style={styles.evidencias}>
            <Text variant="microLabel" color={colors.textSecondary} style={styles.centro}>
              Evidências técnicas
            </Text>
            <View style={styles.evidenciaGrade}>
              <Evidencia
                rotulo="Estado prévio"
                uri={antes ? imageUri(antes.storage_path) : null}
                destaque={false}
              />
              <Evidencia
                rotulo="Pós-manutenção"
                uri={depois ? imageUri(depois.storage_path) : null}
                destaque
              />
            </View>
          </View>
        ) : null}

        {/* Validação de conformidade */}
        <View style={styles.validacao}>
          <View style={styles.validacaoTopo}>
            <View style={styles.iconeMedio}>
              <UserCheck size={22} color={colors.textSecondary} />
            </View>
            <Text variant="microLabel">Validação de conformidade</Text>
          </View>

          <View style={styles.signatureWrap}>
            <View style={styles.signature} {...responder.panHandlers}>
              <Svg width="100%" height="100%" viewBox="0 0 360 250">
                {current.map((path, index) => (
                  <Path
                    key={index}
                    d={path}
                    fill="none"
                    stroke={colors.brandStrong}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
              {strokes.length === 0 ? (
                <View pointerEvents="none" style={styles.signatureHint}>
                  <Text variant="microLabel" color={colors.slate300}>
                    Espaço para assinatura
                  </Text>
                </View>
              ) : null}
            </View>

            {/* No design o botão de limpar mora dentro da área, no canto. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar assinatura"
              onPress={() => setStrokes([])}
              style={({ pressed }) => [styles.limpar, pressed && styles.pressed]}>
              <RotateCcw size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.responsavel}>
            <Text variant="microLabel" color={colors.textSecondary}>
              Responsável pela aprovação
            </Text>
            <Text variant="bodyStrong" style={styles.caixaAlta}>
              {call?.client?.name ?? signerName}
            </Text>
          </View>

          <View style={styles.terms}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: terms }}
              onPress={() => setTerms(!terms)}
              style={[styles.checkbox, terms && styles.checkboxChecked]}>
              {terms ? <Check size={16} color={colors.textOnBrand} strokeWidth={3} /> : null}
            </Pressable>
            <Text variant="body" color={colors.textSecondary} style={styles.flex}>
              Declaro que o serviço foi realizado conforme as especificações e estou de acordo com
              as informações apresentadas nesta Ordem de Serviço.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.footerInner}>
          <Button
            label="Finalizar atendimento"
            icon={Check}
            loading={loading}
            onPress={() => {
              void confirm();
            }}
          />
        </View>
      </View>
    </View>
  );
}

function Evidencia({
  rotulo,
  uri,
  destaque,
}: {
  rotulo: string;
  uri: string | null;
  destaque: boolean;
}) {
  return (
    <View style={[styles.evidencia, destaque && styles.evidenciaDestaque]}>
      <View style={styles.evidenciaFoto}>
        {uri ? (
          <Image source={{ uri }} style={styles.evidenciaImagem} />
        ) : (
          <View style={styles.evidenciaVazia}>
            <Text variant="meta" color={colors.textMuted}>
              Sem registro
            </Text>
          </View>
        )}
      </View>
      <Text
        variant="microLabel"
        color={destaque ? colors.brand : colors.textMuted}
        style={styles.centro}>
        {rotulo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },

  header: {
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitulo: { flex: 1, alignItems: 'center', gap: 2 },
  headerIcone: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaAlta: { textTransform: 'uppercase' },
  centro: { textAlign: 'center' },
  flex: { flex: 1 },

  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: layout.screenPadding,
    gap: spacing.xl,
  },

  cartaoCentrado: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...elevation.card,
  },
  iconeGrande: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeMedio: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  evidencias: { gap: spacing.md },
  evidenciaGrade: { flexDirection: 'row', gap: spacing.md },
  evidencia: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  evidenciaDestaque: { borderWidth: 2, borderColor: colors.brand, ...elevation.card },
  evidenciaFoto: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.slate50,
  },
  evidenciaImagem: { width: '100%', height: '100%' },
  evidenciaVazia: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  validacao: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.lg,
    ...elevation.card,
  },
  validacaoTopo: { alignItems: 'center', gap: spacing.sm },
  signatureWrap: { position: 'relative' },
  signature: {
    height: 220,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  signatureHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limpar: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responsavel: { alignItems: 'center', gap: 2 },

  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  checkbox: {
    width: 25,
    height: 25,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },

  footer: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  footerInner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
