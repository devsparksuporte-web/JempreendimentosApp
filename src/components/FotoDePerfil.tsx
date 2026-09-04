import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/alerta';
import {
  fotoOuBoneco,
  removerFotoDePerfil,
  trocarFotoDePerfil,
  type OrigemDaFoto,
} from '@/services/perfil';
import { colors, spacing } from '@/theme/tokens';

/**
 * Foto do perfil, com o toque que a troca.
 *
 * Componente compartilhado porque cliente, técnico e administração usam
 * telas de perfil diferentes — e duas cópias do mesmo bloco viram duas
 * versões divergentes na primeira correção que alguém esquecer de repetir.
 *
 * A permissão para trocar já é de todos: a política do balde compara a
 * pasta com o dono da sessão, sem olhar o papel.
 */
export function FotoDePerfil({ tamanho = 92 }: { tamanho?: number }) {
  const { profile, refreshProfile } = useAuth();
  const [enviando, setEnviando] = useState(false);

  async function mudar(origem: OrigemDaFoto) {
    if (enviando) return;
    setEnviando(true);
    try {
      const nova = await trocarFotoDePerfil(origem);
      // `null` é desistência no seletor, não erro: nada a avisar.
      if (nova) await refreshProfile();
    } catch (e) {
      Alert.alert('Não foi possível trocar a foto', e instanceof Error ? e.message : '');
    } finally {
      setEnviando(false);
    }
  }

  function escolher() {
    Alert.alert('Foto de perfil', 'De onde quer tirar a foto?', [
      {
        text: 'Câmera',
        onPress: () => {
          void mudar('camera');
        },
      },
      {
        text: 'Galeria',
        onPress: () => {
          void mudar('galeria');
        },
      },
      ...(profile?.avatar_url
        ? [
            {
              text: 'Remover',
              style: 'destructive' as const,
              onPress: () => {
                void (async () => {
                  try {
                    await removerFotoDePerfil();
                    await refreshProfile();
                  } catch (e) {
                    Alert.alert('Não foi possível remover', e instanceof Error ? e.message : '');
                  }
                })();
              },
            },
          ]
        : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  const raio = tamanho / 2;

  return (
    <Pressable
      onPress={escolher}
      disabled={enviando}
      accessibilityRole="button"
      accessibilityLabel="Trocar foto de perfil"
      style={({ pressed }) => [styles.area, pressed && styles.tocado]}>
      <View>
        <Image
          source={{ uri: fotoOuBoneco(profile?.avatar_url, profile?.full_name ?? 'JEmpreendimentos') }}
          style={{ width: tamanho, height: tamanho, borderRadius: raio, backgroundColor: colors.bgApp }}
        />
        <View style={[styles.selo, { right: -2, bottom: -2 }]}>
          <Camera size={15} color={colors.textOnBrand} />
        </View>
      </View>
      <Text variant="meta" color={colors.textSecondary}>
        {enviando ? 'Enviando…' : 'Tocar para trocar a foto'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  area: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm },
  tocado: { opacity: 0.85 },
  selo: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.bgSurface,
  },
});
