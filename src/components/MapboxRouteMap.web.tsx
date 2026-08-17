import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { TechnicianCall } from '@/services/technician';
import { colors, radius, spacing } from '@/theme/tokens';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const DEFAULT_CENTER: [number, number] = [-47, -15];

type Props = { calls: TechnicianCall[]; selectedId: string | null; onSelect: (id: string) => void };
type GeocodedCall = { call: TechnicianCall; coordinates: [number, number] };

export function MapboxRouteMap({ calls, selectedId, onSelect }: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [points, setPoints] = useState<GeocodedCall[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    let active = true;
    async function geocodeCalls() {
      if (!TOKEN || calls.length === 0) { setPoints([]); return; }
      setGeocoding(true);
      const next = await Promise.all(calls.slice(0, 20).map(async (call) => {
        if (!call.address) return null;
        const query = [call.address.street, call.address.number, call.address.city, 'Brasil'].filter(Boolean).join(', ');
        try {
          const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&language=pt-BR&limit=1`);
          if (!response.ok) return null;
          const data = await response.json() as { features?: Array<{ center?: [number, number] }> };
          const center = data.features?.[0]?.center;
          return center ? { call, coordinates: center } : null;
        } catch { return null; }
      }));
      if (active) { setPoints(next.filter(Boolean) as GeocodedCall[]); setGeocoding(false); }
    }
    void geocodeCalls();
    return () => { active = false; };
  }, [calls]);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({ container: containerRef.current, style: 'mapbox://styles/mapbox/light-v11', center: DEFAULT_CENTER, zoom: 3.4, attributionControl: true });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => { markersRef.current.forEach((marker) => marker.remove()); markersRef.current = []; map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const renderMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = points.map(({ call, coordinates }) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.setAttribute('aria-label', `Abrir chamado ${call.code}`);
        element.className = 'jempreendimentos-map-marker';
        element.style.backgroundColor = call.id === selectedId ? '#123C56' : '#2D9BB5';
        element.innerText = String(call.code);
        element.onclick = () => onSelect(call.id);
        return new mapboxgl.Marker({ element, anchor: 'bottom' }).setLngLat(coordinates).addTo(map);
      });
      if (points.length === 1) map.flyTo({ center: points[0].coordinates, zoom: 14, duration: 700 });
      if (points.length > 1) { const bounds = new mapboxgl.LngLatBounds(); points.forEach((point) => bounds.extend(point.coordinates)); map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 700 }); }
    };
    if (map.loaded()) renderMarkers(); else map.once('load', renderMarkers);
    return () => { map.off('load', renderMarkers); };
  }, [points, selectedId, onSelect]);

  if (!TOKEN) return <View style={styles.missing}><Text variant="bodyStrong">Mapa indisponível</Text><Text variant="meta" color={colors.textSecondary}>Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN no ambiente do Expo/Vercel.</Text></View>;
  return <View style={styles.wrapper}><View ref={containerRef} style={styles.map} /><View style={styles.status}>{geocoding ? <><ActivityIndicator size="small" color={colors.brand} /><Text variant="meta" color={colors.textSecondary}>Localizando endereços...</Text></> : <Text variant="meta" color={colors.textSecondary}>{points.length} endereço(s) localizado(s) no Mapbox</Text>}</View></View>;
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, position: 'relative', minHeight: 310 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  status: { position: 'absolute', left: spacing.md, bottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  missing: { minHeight: 310, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.brandTint },
});
