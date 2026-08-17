import { Bell, ChevronRight, LogOut, ShieldCheck, UserRound, Wifi } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type SettingsScreenProps = { roleLabel: string; subtitle: string };

export function SettingsScreen({ roleLabel, subtitle }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { profile, session, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Sair do sistema', 'Deseja encerrar esta sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  };

  return (
    <View style={styles.root}>
      <Header title="Configurações" eyebrow={`JEmpreendimentos · ${roleLabel}`} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.container}>
          <View style={styles.intro}>
            <Text variant="screenTitle">Preferências e acesso</Text>
            <Text variant="body" color={colors.textSecondary}>{subtitle}</Text>
          </View>

          <Card padded="md" style={styles.profileCard}>
            <View style={styles.avatar}><UserRound size={24} color={colors.brandStrong} /></View>
            <View style={styles.profileText}>
              <Text variant="cardTitle">{profile?.full_name ?? 'Usuário JEmpreendimentos'}</Text>
              <Text variant="meta" color={colors.textSecondary}>{session?.user.email ?? 'Sessão autenticada'}</Text>
              <Text variant="microLabel" color={colors.brand}>{roleLabel}</Text>
            </View>
          </Card>

          <Text variant="microLabel" color={colors.textSecondary}>Conta e operação</Text>
          <View style={styles.menuGroup}>
            <SettingRow icon={ShieldCheck} title="Segurança e acesso" description="Sessão protegida pelas políticas do sistema" />
            <SettingRow icon={Bell} title="Notificações" description="Alertas de chamados, prazos e atualizações" />
            <SettingRow icon={Wifi} title="Modo de campo" description="Dados preparados para operação com conexão instável" />
          </View>

          <Pressable onPress={confirmSignOut} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
            <LogOut size={19} color={colors.dangerStrong} />
            <Text variant="bodyStrong" color={colors.dangerStrong}>Sair da conta</Text>
          </Pressable>

          <Text variant="meta" color={colors.textMuted} style={styles.version}>JEmpreendimentos · Ambiente de produção</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SettingRow({ icon: Icon, title, description }: { icon: typeof ShieldCheck; title: string; description: string }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><Icon size={19} color={colors.brandStrong} /></View>
      <View style={styles.rowText}><Text variant="bodyStrong">{title}</Text><Text variant="meta" color={colors.textSecondary}>{description}</Text></View>
      <ChevronRight size={18} color={colors.slate300} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, paddingTop: spacing.xl, gap: spacing.lg },
  intro: { gap: spacing.xs },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brandTint, borderColor: colors.brandSoft },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  profileText: { flex: 1, gap: spacing.xs },
  menuGroup: { backgroundColor: colors.bgSurface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  logout: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft, borderRadius: radius.xl },
  version: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
