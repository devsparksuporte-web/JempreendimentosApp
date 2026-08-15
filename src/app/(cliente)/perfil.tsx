import { LogOut, Mail, Phone, ShieldCheck, User } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { IconTile } from '@/components/ui/IconTile';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { colors, layout, spacing } from '@/theme/tokens';

export default function PerfilScreen() {
  const { profile, session, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Header title="Perfil" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.container, { paddingBottom: spacing.xxl + insets.bottom }]}>
          <Card>
            <View style={styles.row}>
              <IconTile icon={User} />
              <View style={styles.flex}>
                <Text variant="cardTitle">{profile?.full_name || 'Sem nome'}</Text>
                <Text variant="meta" color={colors.textSecondary}>
                  Cliente
                </Text>
              </View>
            </View>
          </Card>

          <Section label="Contato">
            <Card padded="md">
              <View style={styles.linhas}>
                <Linha icon={Mail} rotulo="E-mail" valor={profile?.email ?? session?.user.email ?? '—'} />
                <Linha icon={Phone} rotulo="Telefone" valor={profile?.phone ?? '—'} />
              </View>
            </Card>
          </Section>

          <Section label="Segurança">
            <Card padded="md">
              <View style={styles.row}>
                <IconTile icon={ShieldCheck} size="md" color={colors.success} background={colors.successSoft} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">Seus dados são privados</Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    Somente você e a equipe autorizada têm acesso
                  </Text>
                </View>
              </View>
            </Card>
          </Section>

          <Button label="Sair da conta" icon={LogOut} variant="secondary" onPress={signOut} />
        </View>
      </ScrollView>
    </View>
  );
}

function Linha({
  icon: Icon,
  rotulo,
  valor,
}: {
  icon: typeof Mail;
  rotulo: string;
  valor: string;
}) {
  return (
    <View style={styles.linha}>
      <Icon size={16} color={colors.textMuted} />
      <Text variant="meta" color={colors.textSecondary} style={styles.flex}>
        {rotulo}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  linhas: { gap: spacing.md },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
