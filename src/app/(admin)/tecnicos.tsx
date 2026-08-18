import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import { MessageSquare, Phone, Search, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  estaAoVivo,
  fetchEquipeEmCampo,
  iniciais,
  STATUS_TECNICO,
  type TecnicoEmCampo,
} from '@/services/equipe';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';
import type { TechnicianStatus } from '@/types/database';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const CENTRO_PADRAO: [number, number] = [-47, -15];

type Filtro = 'todos' | TechnicianStatus;

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'disponivel', rotulo: 'Disponíveis' },
  { chave: 'em_atendimento', rotulo: 'Em campo' },
  { chave: 'indisponivel', rotulo: 'Em pausa' },
];

/** A cor do ponto diz o estado do técnico sem precisar ler. */
function corDoStatus(status: TechnicianStatus): string {
  if (status === 'disponivel') return colors.success;
  if (status === 'indisponivel') return colors.warning;
  return colors.brand;
}

export default function TecnicosScreen() {
  const insets = useSafeAreaInsets();

  const [equipe, setEquipe] = useState<TecnicoEmCampo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEquipe(await fetchEquipeEmCampo());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a equipe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipe.filter((t) => {
      const porStatus = filtro === 'todos' || t.status === filtro;
      const porTexto =
        !termo ||
        t.nome.toLowerCase().includes(termo) ||
        (t.chamadoAtual?.cidade ?? '').toLowerCase().includes(termo);
      return porStatus && porTexto;
    });
  }, [equipe, busca, filtro]);

  const comPosicao = useMemo(() => filtrada.filter((t) => t.posicao), [filtrada]);
  const aoVivo = useMemo(() => equipe.filter((t) => estaAoVivo(t.posicao)).length, [equipe]);

  const limites = useMemo(() => {
    if (comPosicao.length < 2) return null;
    const lngs = comPosicao.map((t) => t.posicao!.longitude);
    const lats = comPosicao.map((t) => t.posicao!.latitude);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    };
  }, [comPosicao]);

  const foco = comPosicao.find((t) => t.id === selecionado) ?? comPosicao[0] ?? null;

  return (
    <View style={styles.root}>
      <Header
        title="Técnicos em tempo real"
        eyebrow="Operação · Equipe"
        trailing={
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text variant="meta" color={colors.textSecondary}>
              {aoVivo} ao vivo
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={[styles.container, { paddingBottom: spacing.xxl + insets.bottom }]}>
          <View style={styles.busca}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar técnico por nome ou cidade"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.brand}
              style={styles.buscaInput}
            />
          </View>

          {/* Mapa da equipe */}
          <View style={styles.mapa}>
            {!TOKEN ? (
              <View style={styles.mapaAviso}>
                <Text variant="meta" color={colors.textSecondary}>
                  Configure o token do Mapbox para ver a equipe no mapa.
                </Text>
              </View>
            ) : comPosicao.length === 0 ? (
              <View style={styles.mapaAviso}>
                <Users size={28} color={colors.slate300} />
                <Text variant="bodyStrong" color={colors.textSecondary}>
                  Nenhuma posição reportada
                </Text>
                <Text variant="meta" color={colors.textMuted} style={styles.centro}>
                  Os técnicos aparecem aqui assim que o aplicativo deles enviar a localização.
                </Text>
              </View>
            ) : (
              <MapView style={styles.mapaView} styleURL={Mapbox.StyleURL.Street} scaleBarEnabled={false}>
                {limites ? (
                  <Camera
                    bounds={{
                      ne: limites.ne,
                      sw: limites.sw,
                      paddingTop: 70,
                      paddingBottom: 70,
                      paddingLeft: 70,
                      paddingRight: 70,
                    }}
                    animationDuration={700}
                  />
                ) : (
                  <Camera
                    zoomLevel={13}
                    centerCoordinate={
                      foco ? [foco.posicao!.longitude, foco.posicao!.latitude] : CENTRO_PADRAO
                    }
                    animationDuration={700}
                  />
                )}

                {comPosicao.map((t) => {
                  const ativo = t.id === selecionado;
                  return (
                    <MarkerView
                      key={t.id}
                      coordinate={[t.posicao!.longitude, t.posicao!.latitude]}
                      anchor={{ x: 0.5, y: 0.5 }}>
                      <Pressable
                        onPress={() => setSelecionado(ativo ? null : t.id)}
                        style={[styles.marcador, ativo && styles.marcadorAtivo]}>
                        <Text variant="meta" color={colors.brandStrong}>
                          {iniciais(t.nome)}
                        </Text>
                        <View
                          style={[styles.marcadorStatus, { backgroundColor: corDoStatus(t.status) }]}
                        />
                      </Pressable>
                    </MarkerView>
                  );
                })}
              </MapView>
            )}
          </View>

          {/* Filtros */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtros}>
            {FILTROS.map((f) => {
              const ativo = filtro === f.chave;
              return (
                <Pressable
                  key={f.chave}
                  onPress={() => setFiltro(f.chave)}
                  style={[styles.filtro, ativo && styles.filtroAtivo]}>
                  <Text variant="meta" color={ativo ? colors.textOnBrand : colors.textSecondary}>
                    {f.rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Lista */}
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : filtrada.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum técnico encontrado"
              description="Ajuste a busca ou o filtro para ver a equipe."
            />
          ) : (
            filtrada.map((t) => {
              const info = STATUS_TECNICO[t.status];
              return (
                <Card key={t.id} padded="md" onPress={() => setSelecionado(t.id)}>
                  <View style={styles.linha}>
                    <View style={styles.avatarArea}>
                      <View style={styles.avatar}>
                        <Text variant="bodyStrong" color={colors.brandStrong}>
                          {iniciais(t.nome)}
                        </Text>
                      </View>
                      <View
                        style={[styles.avatarStatus, { backgroundColor: corDoStatus(t.status) }]}
                      />
                    </View>

                    <View style={styles.flex}>
                      <Text variant="cardTitle" numberOfLines={1}>
                        {t.nome}
                      </Text>
                      <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                        {t.chamadoAtual
                          ? `#${t.chamadoAtual.code} · ${t.chamadoAtual.title}`
                          : t.registration
                            ? `Registro ${t.registration}`
                            : 'Sem atendimento no momento'}
                      </Text>
                      <View style={styles.selos}>
                        <View style={[styles.selo, { backgroundColor: corDoStatus(t.status) + '22' }]}>
                          <Text variant="meta" color={corDoStatus(t.status)}>
                            {info.rotulo}
                          </Text>
                        </View>
                        {estaAoVivo(t.posicao) ? (
                          <Text variant="meta" color={colors.textMuted}>
                            Posição atual
                          </Text>
                        ) : (
                          <Text variant="meta" color={colors.textMuted}>
                            Sem posição recente
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.acoes}>
                      <Pressable
                        accessibilityLabel={`Ligar para ${t.nome}`}
                        onPress={() => Linking.openURL('tel:')}
                        style={({ pressed }) => [styles.acao, pressed && styles.pressed]}>
                        <Phone size={16} color={colors.brand} />
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Mensagem para ${t.nome}`}
                        onPress={() => Linking.openURL('sms:')}
                        style={({ pressed }) => [styles.acao, pressed && styles.pressed]}>
                        <MessageSquare size={16} color={colors.brand} />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
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
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  flex: { flex: 1, gap: 2 },
  centro: { textAlign: 'center', maxWidth: 260 },

  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  buscaInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },

  mapa: {
    height: 380,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate100,
  },
  mapaView: { flex: 1 },
  mapaAviso: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },

  marcador: {
    width: 42,
    height: 42,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 2,
    borderColor: colors.brandStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcadorAtivo: { transform: [{ scale: 1.18 }], borderColor: colors.brand },
  marcadorStatus: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.bgSurface,
  },

  filtros: { gap: spacing.sm, paddingRight: spacing.lg },
  filtro: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtroAtivo: { backgroundColor: colors.brandStrong, borderColor: colors.brandStrong },

  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarArea: { position: 'relative' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStatus: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.bgSurface,
  },
  selos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  selo: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },

  acoes: { gap: spacing.sm },
  acao: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
