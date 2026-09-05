import { BatteryCharging, Settings } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { abrirConfiguracoes } from '@/lib/permissoes';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Aviso sobre a economia de bateria segurar as notificações.
 *
 * Não é uma permissão, e por isso não entra no catálogo do assistente: o
 * aviso com o aplicativo fechado chega pelo Android, sem depender de nada
 * que o app possa pedir. O que atrapalha é o sistema pôr o aplicativo para
 * dormir — decisão do dono do aparelho, que só ele desfaz.
 *
 * Aparece em dois lugares de propósito. No assistente, porque é a hora de
 * preparar o aparelho; nas configurações, porque é para lá que a pessoa vai
 * quando o aviso não está chegando, e o assistente ela já passou faz tempo.
 *
 * O botão leva até a tela do aplicativo no Android e para por aí. Responder
 * ao que aparece depois é da pessoa — o sistema não contorna escolha de
 * permissão nem decide por ela.
 */
export function AvisoDeBateria() {
  if (Platform.OS !== 'android') return null;

  return (
    <View style={styles.cartao}>
      <View style={styles.topo}>
        <View style={styles.icone}>
          <BatteryCharging size={22} color={colors.brand} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">Avisos com o aplicativo fechado</Text>
          <Text variant="meta" color={colors.textSecondary}>
            Isto não é uma permissão — é um ajuste do aparelho.
          </Text>
        </View>
      </View>

      <Text variant="meta" color={colors.textSecondary}>
        Para economizar bateria, o Android coloca aplicativos pouco usados para dormir e
        segura os avisos até alguém abrir. Num celular de trabalho isso atrasa chamado.
        Deixe o JEmpreendimentos fora dessa economia:
      </Text>

      <View style={styles.caminho}>
        <Text variant="meta" color={colors.textPrimary}>
          Aplicativos → JEmpreendimentos → Bateria → Irrestrito
        </Text>
        <Text variant="meta" color={colors.textMuted}>
          Em aparelhos Samsung, confira também Bateria → Limites de uso em segundo plano, e
          tire o aplicativo de “Apps em suspensão”.
        </Text>
      </View>

      <Button
        label="Abrir configurações do aparelho"
        icon={Settings}
        variant="secondary"
        onPress={() => {
          void abrirConfiguracoes();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icone: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
  flex: { flex: 1, gap: 2 },
  caminho: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgApp,
  },
});
