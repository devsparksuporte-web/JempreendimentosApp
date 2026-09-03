import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';

import { D } from '@/theme/paletaMapa';

import type { PropsDoMapa } from './MapaDaEquipe.tipos';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

/** Pulsar do pino: 1 -> 1,1 e de volta, sem parar. */
function useCicloPulso() {
  // `useState` com inicializador em vez de `useRef(...).current`: ler um
  // ref durante a renderização é o que o lint acusa, e aqui não há motivo
  // para isso — o valor nasce uma vez e nunca troca.
  const [valor] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, { toValue: 1, duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true }),
        Animated.timing(valor, { toValue: 0, duration: 1000, easing: Easing.bezier(0.4, 0, 0.6, 1), useNativeDriver: true }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [valor]);
  return valor;
}

// Sem esta linha o aplicativo FECHA ao montar o MapView: o SDK nativo lança
// MapboxConfigurationException se o token não estiver configurado antes.
Mapbox.setAccessToken(TOKEN ?? null);

/**
 * Mapa da equipe no celular e no tablet.
 *
 * Existe separado do `.web` porque o `@rnmapbox/maps` é módulo nativo e não
 * tem entrada para navegador — importá-lo num bundle web derruba a tela
 * inteira, sem mensagem.
 */
export function MapaDaEquipe({ pinos, limites, centro, onSelecionar }: PropsDoMapa) {
  const ciclo = useCicloPulso();
  const pulso = {
    transform: [{ scale: ciclo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
    opacity: ciclo.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }),
  };

  return (
    // O design põe o botão de navegação no canto inferior esquerdo, que é
    // onde o Mapbox desenha o logo e a atribuição. Como a atribuição é
    // exigência de licença e não pode sumir, quem se muda é ela.
    <MapView
      style={styles.mapa}
      styleURL={Mapbox.StyleURL.Street}
      scaleBarEnabled={false}
      logoPosition={{ bottom: 8, right: 44 }}
      attributionPosition={{ bottom: 8, right: 8 }}>
      {limites ? (
        <Camera
          bounds={{
            ne: limites.ne,
            sw: limites.sw,
            paddingTop: 60,
            paddingBottom: 60,
            paddingLeft: 60,
            paddingRight: 60,
          }}
          animationDuration={700}
        />
      ) : (
        <Camera zoomLevel={13} centerCoordinate={centro} animationDuration={700} />
      )}

      {pinos.map((p) => (
        <MarkerView
          key={p.id}
          coordinate={[p.longitude, p.latitude]}
          anchor={{ x: 0.5, y: 0.5 }}>
          <Animated.View style={pulso}>
            <Pressable onPress={() => onSelecionar(p.id)} style={styles.pino}>
              <Image source={{ uri: p.avatar }} style={styles.pinoAvatar} />
              <View style={[styles.pinoStatus, { backgroundColor: p.cor }]} />
            </Pressable>
          </Animated.View>
        </MarkerView>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  pino: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: D.branco,
    borderWidth: 2,
    borderColor: D.azul900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinoAvatar: { width: '100%', height: '100%', borderRadius: 12 },
  pinoStatus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: D.branco,
  },
});
