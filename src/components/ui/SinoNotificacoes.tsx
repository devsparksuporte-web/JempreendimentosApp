import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { recarregarNaoLidas, useNaoLidas } from '@/lib/naoLidas';
import { colors, radius } from '@/theme/tokens';

/**
 * Sino com contador de não lidas.
 *
 * O número vem do contador compartilhado, e não de uma consulta própria: o
 * sino aparece em vários cabeçalhos ao mesmo tempo e todos precisam mostrar
 * a mesma coisa depois de uma leitura.
 */
export function SinoNotificacoes({ claro = false }: { claro?: boolean }) {
  const router = useRouter();
  const naoLidas = useNaoLidas();

  useEffect(() => {
    void recarregarNaoLidas();
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'
      }
      onPress={() => router.push('/notificacoes' as never)}
      style={({ pressed }) => [
        styles.botao,
        claro && styles.botaoClaro,
        pressed && styles.pressionado,
      ]}>
      <Bell size={20} color={claro ? colors.textOnBrand : colors.textMuted} />

      {naoLidas > 0 ? (
        <View style={styles.selo}>
          <Text variant="meta" color={colors.textOnBrand} style={styles.numero}>
            {naoLidas > 99 ? '99+' : String(naoLidas)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoClaro: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'transparent' },
  selo: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgApp,
  },
  numero: { fontSize: 9, lineHeight: 12 },
  pressionado: { opacity: 0.8, transform: [{ scale: 0.94 }] },
});
