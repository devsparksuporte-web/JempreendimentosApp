import Mapbox, { Camera, LineLayer, MapView, MarkerView, ShapeSource } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import {
  AirVent,
  CornerUpRight,
  MapPinned,
  Navigation,
  Timer,
  User,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import {
  buscarTrajeto,
  formatarDistancia,
  formatarDuracao,
  type Coordenada,
  type Trajeto,
} from '@/services/navegacao';
import type { TechnicianCall } from '@/services/technician';
import { colors, radius, spacing } from '@/theme/tokens';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const CENTRO_PADRAO: Coordenada = [-47, -15];

Mapbox.setAccessToken(TOKEN ?? null);

type Props = { calls: TechnicianCall[]; selectedId: string | null; onSelect: (id: string) => void };
type Ponto = { call: TechnicianCall; coordinates: Coordenada; ordem: number };

/** A cor do pino comunica a urgência sem precisar ler nada. */
function corDaPrioridade(prioridade: string): string {
  if (prioridade === 'urgente') return colors.danger;
  if (prioridade === 'alta') return colors.warning;
  return colors.brand;
}

/**
 * O endereço precisa ir completo para a geocodificação. Sem estado e CEP o
 * Mapbox escolhe ruas homônimas em outra parte do país.
 */
function enderecoDe(call: TechnicianCall): string | null {
  const a = call.address;
  if (!a) return null;
  return [a.street, a.number, a.district, a.city, a.state, a.zip_code, 'Brasil']
    .filter(Boolean)
    .join(', ');
}

function enderecoCurto(call: TechnicianCall): string {
  const a = call.address;
  if (!a) return 'Endereço não informado';
  return `${a.street}${a.number ? `, ${a.number}` : ''} — ${a.city}`;
}

export function MapboxRouteMap({ calls, selectedId, onSelect }: Props) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [geocodificando, setGeocodificando] = useState(false);
  const [origem, setOrigem] = useState<Coordenada | null>(null);
  const [trajeto, setTrajeto] = useState<Trajeto | null>(null);
  const [navegando, setNavegando] = useState(false);
  const [calculando, setCalculando] = useState(false);

  // Posição do técnico: é dela que a navegação parte.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (ativo) setOrigem([pos.coords.longitude, pos.coords.latitude]);
      } catch {
        // Sem localização a rota parte do primeiro atendimento.
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function geocodificar() {
      if (!TOKEN || calls.length === 0) {
        setPontos([]);
        return;
      }
      setGeocodificando(true);
      const resultado = await Promise.all(
        calls.slice(0, 20).map(async (call, indice) => {
          const query = enderecoDe(call);
          if (!query) return null;
          try {
            const resposta = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
                `?access_token=${TOKEN}&language=pt-BR&country=BR&limit=1`,
            );
            if (!resposta.ok) return null;
            const dados = (await resposta.json()) as { features?: { center?: Coordenada }[] };
            const centro = dados.features?.[0]?.center;
            return centro ? { call, coordinates: centro, ordem: indice + 1 } : null;
          } catch {
            return null;
          }
        }),
      );
      if (ativo) {
        setPontos(resultado.filter(Boolean) as Ponto[]);
        setGeocodificando(false);
      }
    }

    void geocodificar();
    return () => {
      ativo = false;
    };
  }, [calls]);

  const selecionado = useMemo(
    () => pontos.find((p) => p.call.id === selectedId) ?? pontos[0] ?? null,
    [pontos, selectedId],
  );

  /** Enquadra tudo — técnico e paradas — em vez de focar num ponto só. */
  const limites = useMemo(() => {
    const todos = [...pontos.map((p) => p.coordinates), ...(origem ? [origem] : [])];
    if (todos.length < 2) return null;
    const lngs = todos.map((c) => c[0]);
    const lats = todos.map((c) => c[1]);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as Coordenada,
      sw: [Math.min(...lngs), Math.min(...lats)] as Coordenada,
    };
  }, [pontos, origem]);

  const navegar = useCallback(async () => {
    if (!selecionado) return;
    setCalculando(true);
    const partida = origem ?? pontos[0]?.coordinates;
    if (!partida) {
      setCalculando(false);
      return;
    }
    const rota = await buscarTrajeto([partida, selecionado.coordinates]);
    setTrajeto(rota);
    setNavegando(Boolean(rota));
    setCalculando(false);
  }, [origem, pontos, selecionado]);

  function encerrar() {
    setNavegando(false);
    setTrajeto(null);
  }

  const linhaVisitas = useMemo(() => {
    if (navegando || pontos.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: pontos.map((p) => p.coordinates) },
    };
  }, [navegando, pontos]);

  const linhaTrajeto = useMemo(() => {
    if (!navegando || !trajeto) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: trajeto.coordenadas },
    };
  }, [navegando, trajeto]);

  if (!TOKEN) {
    return (
      <View style={styles.aviso}>
        <MapPinned size={32} color={colors.brand} />
        <Text variant="bodyStrong">Mapa indisponível</Text>
        <Text variant="meta" color={colors.textSecondary} style={styles.centro}>
          Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN para exibir a rota.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} scaleBarEnabled={false}>
        {navegando || !limites ? (
          <Camera
            zoomLevel={navegando ? 14 : selecionado ? 13 : 3}
            centerCoordinate={selecionado?.coordinates ?? origem ?? CENTRO_PADRAO}
            animationDuration={700}
          />
        ) : (
          <Camera
            bounds={{
              ne: limites.ne,
              sw: limites.sw,
              paddingTop: 90,
              paddingBottom: 190,
              paddingLeft: 70,
              paddingRight: 70,
            }}
            animationDuration={700}
          />
        )}

        {linhaVisitas ? (
          <ShapeSource id="visitas" shape={linhaVisitas}>
            <LineLayer
              id="visitas-linha"
              style={{
                lineColor: colors.brandSoft,
                lineWidth: 3,
                lineDasharray: [2, 2],
                lineCap: 'round',
              }}
            />
          </ShapeSource>
        ) : null}

        {linhaTrajeto ? (
          <ShapeSource id="trajeto" shape={linhaTrajeto}>
            <LineLayer
              id="trajeto-linha"
              style={{ lineColor: colors.brand, lineWidth: 6, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
        ) : null}

        {/* Técnico: identificado, não um ponto anônimo. */}
        {origem ? (
          <MarkerView coordinate={origem} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.tecnico}>
              <View style={styles.tecnicoPonto}>
                <User size={13} color={colors.textOnBrand} />
              </View>
              <View style={styles.tecnicoEtiqueta}>
                <Text variant="meta" color={colors.textOnBrand}>
                  VOCÊ
                </Text>
              </View>
            </View>
          </MarkerView>
        ) : null}

        {pontos.map((ponto) => {
          const ativo = ponto.call.id === selecionado?.call.id;
          const cor = corDaPrioridade(ponto.call.priority);
          return (
            <MarkerView
              key={ponto.call.id}
              coordinate={ponto.coordinates}
              anchor={{ x: 0.5, y: 1 }}>
              <Pressable onPress={() => onSelect(ponto.call.id)} style={styles.pinoArea}>
                <View
                  style={[
                    styles.pino,
                    { backgroundColor: cor },
                    ativo && styles.pinoAtivo,
                  ]}>
                  <Text variant="meta" color={colors.textOnBrand}>
                    {ponto.ordem}
                  </Text>
                </View>
                <View style={[styles.pinoBico, { borderTopColor: cor }]} />
              </Pressable>
            </MarkerView>
          );
        })}
      </MapView>

      {geocodificando ? (
        <View style={styles.carregando}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}

      {/* Legenda: explica a cor dos pinos sem ocupar espaço. */}
      {!navegando && pontos.length > 0 ? (
        <View style={styles.legenda}>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: colors.danger }]} />
            <Text variant="meta" color={colors.textSecondary}>
              Urgente
            </Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: colors.warning }]} />
            <Text variant="meta" color={colors.textSecondary}>
              Alta
            </Text>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: colors.brand }]} />
            <Text variant="meta" color={colors.textSecondary}>
              Normal
            </Text>
          </View>
        </View>
      ) : null}

      {navegando && trajeto ? (
        <View style={styles.painel}>
          <View style={styles.painelTopo}>
            <View style={styles.flex}>
              <Text variant="microLabel" color={colors.textSecondary}>
                Navegando até a parada {selecionado?.ordem}
              </Text>
              <Text variant="cardTitle">
                {formatarDistancia(trajeto.distancia)} · {formatarDuracao(trajeto.duracao)}
              </Text>
            </View>
            <Pressable
              onPress={encerrar}
              accessibilityLabel="Encerrar navegação"
              style={({ pressed }) => [styles.fechar, pressed && styles.pressed]}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.manobras} showsVerticalScrollIndicator={false}>
            {trajeto.manobras.map((m, i) => (
              <View key={i} style={styles.manobra}>
                <CornerUpRight size={16} color={colors.brand} />
                <View style={styles.flex}>
                  <Text variant="body" numberOfLines={2}>
                    {m.instrucao}
                  </Text>
                  {m.distancia > 0 ? (
                    <Text variant="meta" color={colors.textMuted}>
                      {formatarDistancia(m.distancia)}
                      {m.nome ? ` · ${m.nome}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : selecionado ? (
        /* Cartão da parada selecionada: quem é, onde, o quê. */
        <View style={styles.cartao}>
          <View style={styles.cartaoTopo}>
            <View
              style={[
                styles.cartaoOrdem,
                { backgroundColor: corDaPrioridade(selecionado.call.priority) },
              ]}>
              <Text variant="meta" color={colors.textOnBrand}>
                {selecionado.ordem}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text variant="cardTitle" numberOfLines={1}>
                {selecionado.call.client?.name ?? 'Cliente'}
              </Text>
              <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                #{selecionado.call.code} · {selecionado.call.title}
              </Text>
            </View>
          </View>

          <View style={styles.cartaoLinha}>
            <MapPinned size={13} color={colors.warning} />
            <Text variant="meta" color={colors.textSecondary} numberOfLines={1} style={styles.flex}>
              {enderecoCurto(selecionado.call)}
            </Text>
          </View>

          {selecionado.call.equipment ? (
            <View style={styles.cartaoLinha}>
              <AirVent size={13} color={colors.brand} />
              <Text variant="meta" color={colors.textSecondary} numberOfLines={1} style={styles.flex}>
                {[selecionado.call.equipment.brand ?? 'Equipamento', selecionado.call.equipment.environment]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={navegar}
            disabled={calculando}
            style={({ pressed }) => [styles.botao, pressed && styles.pressed]}>
            {calculando ? (
              <ActivityIndicator color={colors.textOnBrand} size="small" />
            ) : (
              <Navigation size={16} color={colors.textOnBrand} />
            )}
            <Text variant="meta" color={colors.textOnBrand}>
              {calculando ? 'Traçando rota…' : 'Navegar até aqui'}
            </Text>
          </Pressable>
        </View>
      ) : pontos.length === 0 && !geocodificando ? (
        <View style={styles.cartao}>
          <View style={styles.cartaoLinha}>
            <Timer size={14} color={colors.textMuted} />
            <Text variant="meta" color={colors.textSecondary} style={styles.flex}>
              Nenhum endereço localizado para os atendimentos de hoje.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 460, borderRadius: radius.xl, overflow: 'hidden', position: 'relative' },
  map: { flex: 1, minHeight: 460 },
  aviso: {
    minHeight: 460,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.brandTint,
    borderRadius: radius.xl,
  },
  centro: { textAlign: 'center', maxWidth: 280 },
  flex: { flex: 1, gap: 2 },

  // Pino numerado com bico, colorido pela prioridade.
  pinoArea: { alignItems: 'center' },
  pino: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgSurface,
  },
  pinoAtivo: { transform: [{ scale: 1.25 }] },
  pinoBico: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },

  // Marcador do técnico.
  tecnico: { alignItems: 'center', gap: 3 },
  tecnicoPonto: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandStrong,
    borderWidth: 3,
    borderColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tecnicoEtiqueta: {
    backgroundColor: colors.brandStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },

  carregando: { position: 'absolute', top: spacing.md, right: spacing.md },

  legenda: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendaCor: { width: 8, height: 8, borderRadius: 4 },

  cartao: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cartaoOrdem: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  botao: {
    marginTop: spacing.xs,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
  },

  painel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    maxHeight: 210,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  painelTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fechar: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate100,
  },
  manobras: { maxHeight: 130 },
  manobra: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: { opacity: 0.85 },
});
