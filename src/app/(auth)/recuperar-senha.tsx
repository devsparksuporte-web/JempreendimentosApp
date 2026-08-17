import { LockKeyhole, Mail, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

export default function RecoverPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) { setError('Informe seu e-mail corporativo.'); return; }
    setLoading(true); setError(null);
    try { await resetPassword(email); setSent(true); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.'); } finally { setLoading(false); }
  }

  return <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
    <View style={styles.hero}><View style={styles.icon}><LockKeyhole size={25} color={colors.textOnBrand} /></View><Text variant="screenTitle" color={colors.textOnBrand} style={styles.heroTitle}>Recuperar Senha</Text><Text variant="body" color={colors.slate200} style={styles.heroSubtitle}>Siga as etapas para redefinir seu acesso</Text><View style={styles.steps}><View style={styles.stepActive} /><View style={styles.step} /><View style={styles.step} /></View></View>
    <Card style={styles.card}><Text variant="microLabel" color={colors.brand}>ETAPA 01</Text><Text variant="screenTitle">Identifique seu e-mail</Text><Text variant="body" color={colors.textSecondary}>Enviaremos um link de segurança para redefinir sua senha.</Text><View style={styles.field}><Mail size={18} color={colors.textMuted} /><TextInput value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" style={styles.input} /></View>{error ? <Text variant="body" color={colors.dangerStrong}>{error}</Text> : null}{sent ? <Text variant="body" color={colors.successStrong}>Link enviado. Verifique sua caixa de entrada.</Text> : <Button label="ENVIAR CÓDIGO" icon={Send} onPress={() => { void submit(); }} loading={loading} />}<Pressable onPress={() => router.replace('/(auth)/login')} style={styles.back}><Text variant="bodyStrong" color={colors.brand}>VOLTAR AO LOGIN</Text></Pressable></Card>
    <View style={styles.support}><Text variant="body" color={colors.textSecondary}>Precisa de ajuda?</Text><Pressable onPress={() => undefined}><Text variant="bodyStrong" color={colors.brand}>Contate o suporte técnico</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: layout.screenPadding, gap: spacing.lg }, heroTitle: { textAlign: 'center' }, heroSubtitle: { textAlign: 'center' }, hero: { backgroundColor: colors.brandStrong, marginHorizontal: -layout.screenPadding, paddingHorizontal: layout.screenPadding, paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }, icon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, steps: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, step: { width: 34, height: 4, borderRadius: radius.pill, backgroundColor: colors.slate300 }, stepActive: { width: 34, height: 4, borderRadius: radius.pill, backgroundColor: colors.textOnBrand }, card: { gap: spacing.md, marginTop: -spacing.xl }, field: { minHeight: touch.minTarget, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.slate50, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg }, input: { flex: 1, color: colors.textPrimary, fontFamily: fonts.medium, fontSize: 14, paddingVertical: spacing.md }, back: { alignItems: 'center', paddingVertical: spacing.sm }, support: { alignItems: 'center', gap: spacing.xs }, });
