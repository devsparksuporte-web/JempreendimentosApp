import Mapbox, { Camera, LineLayer, MapView, MarkerView, ShapeSource } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { CornerUpRight, MapPinned, Navigation, Route as RouteIcon, X } from 'lucide-react-native';
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

/** Centro de fallback: Brasil, usado enquanto nada foi geocodificado. */
const CENTRO_PADRAO: Coordenada = [-47, -15];

Mapbox.setAccessToken(TOKEN ?? null);

type Props = { calls: TechnicianCall[]; selectedId: string | null; onSelect: (id: string) => void };
type Ponto = { call: TechnicianCall; coordinates: Coordenada };

/**
 * O endereço precisa ir completo para a geocodificação. Sem estado e CEP o
 * Mapbox escolhe ruas homônimas em outra parte do país — o que já aconteceu
 * aqui, com um chamado de São Paulo caindo no Mato Grosso do Sul.
 */
function enderecoDe(call: TechnicianCall): string | null {
  const a = call.address;
  if (!a) return null;
  return [a.street, a.number, a.district, a.city, a.state, a.zip_code, 'Brasil']
    .filter(Boolean)
    .join(', ');
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
        // Sem localização a rota simplesmente parte do primeiro atendimento.
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
        calls.slice(0, 20).map(async (call) => {
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
            return centro ? { call, coordinates: centro } : null;
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

  /** Traça o trajeto real, pelas ruas, da posição atual até o atendimento. */
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

  // Enquanto não há navegação ativa, mostra a sequência das visitas do dia.
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
        <Camera
          zoomLevel={navegando ? 14 : selecionado ? 13 : 3}
          centerCoordinate={selecionado?.coordinates ?? origem ?? CENTRO_PADRAO}
          animationDuration={700}
        />

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

        {origem ? (
          <MarkerView coordinate={origem}>
            <View style={styles.origem} />
          </MarkerView>
        ) : null}

        {pontos.map((ponto) => {
          const ativo = ponto.call.id === selecionado?.call.id;
          return (
            <MarkerView key={ponto.call.id} coordinate={ponto.coordinates}>
              <Pressable
                onPress={() => onSelect(ponto.call.id)}
                style={[styles.marcador, ativo && styles.marcadorAtivo]}>
                <Text variant="meta" color={ativo ? colors.textOnBrand : colors.brandStrong}>
                  #{ponto.call.code}
                </Text>
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

      {/* Painel de navegação: fica sobre o mapa, dentro do app. */}
      {navegando && trajeto ? (
        <View style={styles.painel}>
          <View style={styles.painelTopo}>
            <View style={styles.flex}>
              <Text variant="microLabel" color={colors.textSecondary}>
                Navegando até #{selecionado?.call.code}
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
      ) : null}

      {!navegando && pontos.length > 1 ? (
        <View style={styles.selo}>
          <RouteIcon size={13} color={colors.brandStrong} />
          <Text variant="meta" color={colors.brandStrong}>
            {pontos.length} paradas
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 310, borderRadius: radius.xl, overflow: 'hidden', position: 'relative' },
  map: { flex: 1, minHeight: 310 },
  aviso: {
    minHeight: 310,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.brandTint,
    borderRadius: radius.xl,
  },
  centro: { textAlign: 'center', maxWidth: 280 },
  flex: { flex: 1, gap: 2 },

  marcador: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.bgSurface,
  },
  marcadorAtivo: { backgroundColor: colors.brand },
  origem: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.bgSurface,
  },

  carregando: { position: 'absolute', top: spacing.md, right: spacing.md },

  botao: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
  },
  selo: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
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
