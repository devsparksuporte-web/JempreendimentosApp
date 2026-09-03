import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme/tokens';

import type { PropsDoMapa } from './MapaDaEquipe.tipos';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

/**
 * Mapa da equipe no navegador.
 *
 * O `@rnmapbox/maps` não roda na web — não tem entrada para navegador, e
 * importá-lo derrubava a tela inteira em branco, sem mensagem. Aqui a
 * mesma informação é desenhada com `mapbox-gl`, que é a biblioteca de web
 * do próprio Mapbox e já era usada na rota do chamado.
 *
 * O marcador é um elemento HTML comum em vez do avatar animado do
 * aplicativo: no monitor a animação não ajuda ninguém a achar o técnico, e
 * um DOM mais simples é um DOM que não trava com a equipe inteira em campo.
 */
export function MapaDaEquipe({ pinos, limites, centro, onSelecionar }: PropsDoMapa) {
  const alvo = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<mapboxgl.Map | null>(null);
  const marcadores = useRef<mapboxgl.Marker[]>([]);

  // Cria o mapa uma vez. Recriar a cada atualização de posição faria a tela
  // piscar a cada dois minutos, que é o intervalo de envio dos técnicos.
  useEffect(() => {
    if (!TOKEN || !alvo.current || mapa.current) return;
    mapboxgl.accessToken = TOKEN;
    mapa.current = new mapboxgl.Map({
      container: alvo.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: centro,
      zoom: 12,
    });
    mapa.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marcadores e enquadramento acompanham os dados.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;

    marcadores.current.forEach((marcador) => marcador.remove());
    marcadores.current = [];

    for (const p of pinos) {
      const elemento = document.createElement('button');
      elemento.type = 'button';
      elemento.title = p.nome;
      elemento.setAttribute('aria-label', `Ver ${p.nome} no mapa`);
      elemento.style.cssText = [
        'width:34px',
        'height:34px',
        'border-radius:12px',
        'border:2px solid ' + colors.brandStrong,
        'background:#fff center/cover no-repeat url("' + p.avatar + '")',
        'box-shadow:0 0 0 3px ' + p.cor + '55',
        'cursor:pointer',
        'padding:0',
      ].join(';');
      elemento.addEventListener('click', () => onSelecionar(p.id));

      marcadores.current.push(
        new mapboxgl.Marker({ element: elemento }).setLngLat([p.longitude, p.latitude]).addTo(m),
      );
    }

    if (limites) {
      m.fitBounds([limites.sw, limites.ne], { padding: 60, duration: 700, maxZoom: 15 });
    } else {
      m.easeTo({ center: centro, zoom: 13, duration: 700 });
    }
  }, [pinos, limites, centro, onSelecionar]);

  if (!TOKEN) {
    return (
      <View style={styles.semToken}>
        <Text variant="bodyStrong">Mapa indisponível</Text>
        <Text variant="meta" color={colors.textSecondary} style={styles.centro}>
          Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN no ambiente da web.
        </Text>
      </View>
    );
  }

  // `ref` de div só existe no react-native-web, onde View vira elemento HTML.
  return <View style={styles.mapa} ref={alvo as never} />;
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  semToken: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  centro: { textAlign: 'center' },
});
