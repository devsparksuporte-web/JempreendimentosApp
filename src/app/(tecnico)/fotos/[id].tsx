import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Aperture,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  Clock,
  Image as ImageIcon,
  Info,
  Upload,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  captureAndUploadPhoto,
  fetchServicePhotos,
  fetchTechnicianCall,
  pickAndUploadPhoto,
  type TechnicianCall,
  type TechnicianPhoto,
} from '@/services/technician';
import { colors, elevation, fonts, layout, radius, spacing } from '@/theme/tokens';

type Etapa = TechnicianPhoto['stage'];

const ETAPAS: { chave: Etapa; aba: string; titulo: string; explicacao: string }[] = [
  {
    chave: 'antes',
    aba: 'Antes',
    titulo: 'Registrar foto inicial',
    explicacao: 'Capture o estado atual do equipamento para validação técnica do atendimento.',
  },
  {
    chave: 'durante',
    aba: 'Durante',
    titulo: 'Registrar a execução',
    explicacao: 'Mostre o serviço em andamento — peças abertas, medições, o que foi encontrado.',
  },
  {
    chave: 'depois',
    aba: 'Depois',
    titulo: 'Registrar foto final',
    explicacao: 'Comprove o resultado do atendimento com o equipamento já montado e em operação.',
  },
];

/** Critérios que fazem a foto servir como prova técnica. */
const REQUISITOS = [
  'Enquadramento frontal da unidade',
  'Foco na etiqueta de patrimônio',
  'Iluminação adequada da área técnica',
];

export default function PhotoRegistrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [call, setCall] = useState<TechnicianCall | null>(null);
  const [photos, setPhotos] = useState<TechnicianPhoto[]>([]);
  const [stage, setStage] = useState<Etapa>('antes');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const serviceCall = await fetchTechnicianCall(id);
      setCall(serviceCall);
      setPhotos(await fetchServicePhotos(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as fotos.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const etapa = ETAPAS.find((e) => e.chave === stage)!;
  const passo = ETAPAS.findIndex((e) => e.chave === stage) + 1;
  const currentPhotos = useMemo(() => photos.filter((p) => p.stage === stage), [photos, stage]);
  /** Na foto final, o técnico compara com o estado inicial que ele mesmo registrou. */
  const referencia = useMemo(() => photos.find((p) => p.stage === 'antes'), [photos]);

  async function addPhoto(mode: 'camera' | 'gallery') {
    if (!call) return;
    setBusy(true);
    setError(null);
    try {
      const photo =
        mode === 'camera'
          ? await captureAndUploadPhoto(call, stage)
          : await pickAndUploadPhoto(call, stage);
      if (photo) setPhotos((current) => [...current, photo]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a foto.');
    } finally {
      setBusy(false);
    }
  }

  function imageUri(path: string) {
    return supabase.storage.from('service-photos').getPublicUrl(path).data.publicUrl;
  }

  function save() {
    const temAntes = photos.some((p) => p.stage === 'antes');
    const temDepois = photos.some((p) => p.stage === 'depois');
    if (!temAntes || !temDepois) {
      Alert.alert(
        'Evidência obrigatória',
        'Registre pelo menos uma foto antes e uma foto depois do serviço.',
      );
      return;
    }
    Alert.alert('Registro salvo', 'As evidências estão vinculadas à ordem de serviço.', [
      { text: 'Concluir', onPress: () => router.back() },
    ]);
  }

  return (
    <View style={styles.root}>
      {/* Cabeçalho branco com o título centralizado, como no design. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.back,
            { top: insets.top + spacing.lg },
            pressed && styles.pressed,
          ]}>
          <ChevronLeft size={21} color={colors.textMuted} />
        </Pressable>

        <View style={styles.headerTitulo}>
          <Text variant="microLabel" color={colors.brand}>
            Registro de chamado
          </Text>
          <Text variant="screenTitle" style={styles.caixaAlta}>
            {etapa.aba === 'Antes' ? 'Foto inicial' : etapa.aba === 'Depois' ? 'Foto final' : 'Execução'}
          </Text>
        </View>

        <View style={styles.headerIcone}>
          <Camera size={20} color={colors.brand} />
        </View>
      </View>

      {loading ? (
        <LoadingState />
      ) : error && !call ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
            showsVerticalScrollIndicator={false}>
            {/* Progresso das etapas de evidência. */}
            <View style={styles.progresso}>
              <View style={styles.progressoTopo}>
                <Text variant="microLabel" color={colors.textMuted}>Progresso</Text>
                <Text variant="microLabel" color={colors.brand}>Etapa {passo} de {ETAPAS.length}</Text>
              </View>
              <View style={styles.progressoTrilho}>
                <View style={[styles.progressoValor, { width: `${(passo / ETAPAS.length) * 100}%` }]} />
              </View>
            </View>

            <View style={styles.tabs}>
              {ETAPAS.map((e) => (
                <Pressable
                  key={e.chave}
                  onPress={() => setStage(e.chave)}
                  style={[styles.tab, stage === e.chave && styles.tabActive]}>
                  <Text variant="meta" color={stage === e.chave ? colors.brand : colors.textMuted}>
                    {e.aba}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Sem foto na etapa, a tela vira o convite a capturar — é o
                estado que o design desenha. Com foto, a galeria assume. */}
            {currentPhotos.length === 0 ? (
              <View style={styles.captura}>
                <View style={styles.capturaTitulo}>
                  <Text variant="screenTitle" style={styles.centro}>
                    {etapa.titulo}
                  </Text>
                  <Text variant="microLabel" color={colors.brand}>
                    Registro técnico de equipamento
                  </Text>
                </View>

                <View style={styles.capturaCirculo}>
                  <Camera size={38} color={colors.brand} />
                </View>

                <View style={styles.capturaTexto}>
                  <Text variant="bodyStrong" style={styles.centro}>
                    Documentação obrigatória
                  </Text>
                  <Text variant="body" color={colors.textSecondary} style={styles.centro}>
                    {etapa.explicacao}
                  </Text>
                </View>

                <View style={styles.capturaBotoes}>
                  <Button
                    label="Abrir câmera"
                    icon={Aperture}
                    loading={busy}
                    onPress={() => {
                      void addPhoto('camera');
                    }}
                  />
                  <Button
                    label="Da galeria"
                    icon={Upload}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => {
                      void addPhoto('gallery');
                    }}
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.gallery}>
                  {currentPhotos.map((photo) => (
                    <View key={photo.id} style={styles.photo}>
                      <Image source={{ uri: imageUri(photo.storage_path) }} style={styles.photoImage} />
                      <View style={styles.photoBadge}>
                        <Text variant="microLabel" color={colors.textOnBrand}>
                          {etapa.aba}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.maisBotoes}>
                  <View style={styles.flex}>
                    <Button
                      label="Câmera"
                      icon={Camera}
                      variant="secondary"
                      loading={busy}
                      onPress={() => {
                        void addPhoto('camera');
                      }}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      label="Galeria"
                      icon={ImageIcon}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => {
                        void addPhoto('gallery');
                      }}
                    />
                  </View>
                </View>
              </>
            )}

            {stage === 'depois' ? (
              <View style={styles.instrucao}>
                <Info size={20} color={colors.brandStrong} />
                <View style={styles.flex}>
                  <Text variant="microLabel" color={colors.brandStrong}>Instrução técnica</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    Registre a condição do equipamento após a execução. Esta evidência é
                    indispensável para o encerramento da ordem de serviço.
                  </Text>
                </View>
              </View>
            ) : null}

            {stage === 'depois' && referencia ? (
              <View style={styles.referencia}>
                <Text variant="microLabel" color={colors.textMuted} style={styles.centro}>
                  Referência: estado inicial
                </Text>
                <View style={styles.referenciaFoto}>
                  <Image source={{ uri: imageUri(referencia.storage_path) }} style={styles.referenciaImagem} />
                  <View style={styles.referenciaSelo}>
                    <Clock size={13} color={colors.brandSoft} />
                    <Text variant="meta" color={colors.textOnBrand}>
                      Registrada às {formatTime(referencia.taken_at)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.requisitos}>
              <Text variant="microLabel" color={colors.textSecondary} style={styles.centro}>
                Requisitos de qualidade
              </Text>
              <View style={styles.requisitosCard}>
                {REQUISITOS.map((texto) => (
                  <View key={texto} style={styles.requisito}>
                    <View style={styles.requisitoIcone}>
                      <Check size={16} color={colors.brand} strokeWidth={3} />
                    </View>
                    <Text variant="body" color={colors.textSecondary} style={styles.flex}>
                      {texto}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text variant="microLabel" color={colors.textMuted}>
                Observações do registro
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Adicione notas sobre o registro fotográfico…"
                placeholderTextColor={colors.slate300}
                style={styles.notes}
              />
            </View>

            {error ? (
              <Text variant="body" color={colors.dangerStrong} style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          {/* Rodapé fixo com a ação de fechar o registro. */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.footerInner}>
              <Button label="Confirmar e prosseguir" icon={ArrowRight} onPress={save} />
            </View>
          </View>
        </>
      )}
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
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    position: 'absolute',
    left: layout.screenPadding,
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitulo: { alignItems: 'center', gap: 2 },
  headerIcone: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaAlta: { textTransform: 'uppercase' },
  centro: { textAlign: 'center' },

  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    padding: layout.screenPadding,
    gap: spacing.xl,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.slate100,
    padding: 5,
    borderRadius: radius.xl,
    gap: 5,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  tabActive: { backgroundColor: colors.bgSurface, ...elevation.card },

  captura: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: 28,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xl,
    ...elevation.card,
  },
  capturaTitulo: { alignItems: 'center', gap: spacing.xs },
  capturaCirculo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandTint,
    borderWidth: 4,
    borderColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  capturaTexto: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  capturaBotoes: { alignSelf: 'stretch', gap: spacing.md, maxWidth: 320, width: '100%' },

  gallery: { gap: spacing.md },
  photo: {
    height: 220,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoImage: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.brandStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  maisBotoes: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },

  progresso: { gap: spacing.sm },
  progressoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  progressoTrilho: {
    height: 6,
    backgroundColor: colors.slate200,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressoValor: { height: '100%', backgroundColor: colors.brand, borderRadius: radius.pill },

  instrucao: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },

  referencia: { gap: spacing.md },
  referenciaFoto: {
    height: 190,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate100,
  },
  referenciaImagem: { width: '100%', height: '100%', opacity: 0.85 },
  referenciaSelo: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: 'rgba(6,21,46,0.66)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },

  requisitos: { gap: spacing.md },
  requisitosCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  requisito: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  requisitoIcone: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  field: { gap: spacing.sm },
  notes: {
    minHeight: 108,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  error: { padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radius.md },

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
