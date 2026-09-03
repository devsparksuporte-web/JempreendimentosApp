import { LogOut, Smartphone } from 'lucide-react-native';
import { Image, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Aviso para quem entra como técnico pelo navegador.
 *
 * O trabalho do técnico é em campo: ler QR do equipamento, tirar foto do
 * antes e do depois, seguir rota, colher assinatura. Nada disso existe num
 * monitor — a câmera, o GPS e o dedo do cliente estão no celular.
 *
 * Por isso a web atende administração e cliente, e o técnico é mandado para
 * o aplicativo. Preferi uma tela que explica a deixar o acesso funcionando
 * pela metade: um técnico que entra e não encontra o leitor de QR conclui
 * que o sistema está quebrado.
 *
 * Isto NÃO é controle de segurança — quem decide o que cada um lê é a RLS,
 * no banco. É orientação de uso.
 */
export default function AcessoPeloAppScreen() {
  const { signOut, profile } = useAuth();

  return (
    <View style={styles.raiz}>
      <Card style={styles.cartao}>
        <Image
          source={require('@/assets/images/logo-j.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.selo}>
          <Smartphone size={26} color={colors.brand} />
        </View>

        <Text variant="screenTitle" color={colors.brandStrong} style={styles.centro}>
          Use o aplicativo
        </Text>

        <Text variant="body" color={colors.textSecondary} style={styles.centro}>
          {profile?.full_name ? `${profile.full_name}, o ` : 'O '}
          acesso de técnico funciona no celular. É lá que estão a leitura de QR, as fotos do
          atendimento, a rota até o cliente e a assinatura de aceite.
        </Text>

        <Text variant="meta" color={colors.textMuted} style={styles.centro}>
          O navegador atende a administração e o cliente.
        </Text>

        <Button
          label="Sair da conta"
          icon={LogOut}
          variant="secondary"
          onPress={() => {
            void signOut();
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgApp,
    padding: spacing.lg,
  },
  cartao: { width: '100%', maxWidth: 460, alignItems: 'center', gap: spacing.md },
  logo: { width: 84, height: 84 },
  selo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
  centro: { textAlign: 'center' },
});
