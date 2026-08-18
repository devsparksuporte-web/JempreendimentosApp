import Mapbox, { Camera, MapView, MarkerView, ShapeSource, LineLayer } from '@rnmapbox/maps';
import { ExternalLink, MapPinned } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { TechnicianCall } from '@/services/technician';
import { colors, radius, spacing } from '@/theme/tokens';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

/** Centro de fallback: Brasil, usado enquanto nada foi geocodificado. */
const DEFAULT_CENTER: [number, number] = [-47, -15];

Mapbox.setAccessToken(TOKEN ?? null);

type Props = { calls: TechnicianCall[]; selectedId: string | null; onSelect: (id: string) => void };
type Ponto = { call: TechnicianCall; coordinates: [number, number] };

function enderecoDe(call: TechnicianCall): string | null {
  if (!call.address) return null;
  return [call.address.street, call.address.number, call.address.city, 'Brasil']
    .filter(Boolean)
    .join(', ');
}

export function MapboxRouteMap({ calls, selectedId, onSelect }: Props) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Os chamados guardam endereço em texto, não coordenada. Geocodificamos
  // pela API do Mapbox — mesma lógica da versão web.
  useEffect(() => {
    let ativo = true;

    async function geocodificar() {
      if (!TOKEN || calls.length === 0) {
        setPontos([]);
        return;
      }
      setCarregando(true);
      const resultado = await Promise.all(
        calls.slice(0, 20).map(async (call) => {
          const query = enderecoDe(call);
          if (!query) return null;
          try {
            const resposta = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
                `?access_token=${TOKEN}&language=pt-BR&limit=1`,
            );
            if (!resposta.ok) return null;
            const dados = (await resposta.json()) as { features?: { center?: [number, number] }[] };
            const centro = dados.features?.[0]?.center;
            return centro ? { call, coordinates: centro } : null;
          } catch {
            return null;
          }
        }),
      );
      if (ativo) {
        setPontos(resultado.filter(Boolean) as Ponto[]);
        setCarregando(false);
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

  const rota = useMemo(() => {
    if (pontos.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: pontos.map((p) => p.coordinates) },
    };
  }, [pontos]);

  async function abrirNavegacao() {
    const query = selecionado ? enderecoDe(selecionado.call) : null;
    if (!query) return;
    await Linking.openURL(`https://www.mapbox.com/directions/?destination=${encodeURIComponent(query)}`);
  }

  if (!TOKEN) {
    return (
      <View style={styles.aviso}>
        <MapPinned size={32} color={colors.brand} />
        <Text variant="bodyStrong">Mapa indisponível</Text>
        <Text variant="meta" color={colors.textSecondary} style={styles.center}>
          Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN para exibir a rota.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} styleURL={Mapbox.StyleURL.Street} scaleBarEnabled={false}>
        <Camera
          zoomLevel={selecionado ? 13 : 3}
          centerCoordinate={selecionado?.coordinates ?? DEFAULT_CENTER}
          animationDuration={600}
        />

        {rota ? (
          <ShapeSource id="rota" shape={rota}>
            <LineLayer
              id="rota-linha"
              style={{ lineColor: colors.brand, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
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

      {carregando ? (
        <View style={styles.carregando}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}

      {selecionado ? (
        <Pressable
          onPress={abrirNavegacao}
          style={({ pressed }) => [styles.botao, pressed && styles.pressed]}>
          <ExternalLink size={16} color={colors.textOnBrand} />
          <Text variant="meta" color={colors.textOnBrand}>
            Abrir navegação
          </Text>
        </Pressable>
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
  center: { textAlign: 'center', maxWidth: 280 },
  marcador: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.bgSurface,
  },
  marcadorAtivo: { backgroundColor: colors.brand },
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
  pressed: { opacity: 0.8 },
});
