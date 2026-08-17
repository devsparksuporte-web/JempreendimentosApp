import { Eye, EyeOff, Lock, LogIn, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const criando = mode === 'criar';

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    if (criando && !fullName.trim()) { setError('Informe seu nome.'); return; }
    setLoading(true);
    try { if (criando) await signUp(email, password, fullName); else await signIn(email, password); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível continuar.'); }
    finally { setLoading(false); }
  }

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled"><View style={styles.container}><View style={styles.hero}><View style={styles.brandMark}><Text variant="screenTitle" color={colors.textOnBrand}>J</Text></View><Text variant="screenTitle" color={colors.textOnBrand}>JEMPREENDIMENTOS</Text><Text variant="microLabel" color={colors.slate200}>GESTÃO DE SERVIÇOS</Text></View><Card style={styles.card}><Text variant="screenTitle">{criando ? 'Crie sua conta' : 'Acesse sua conta'}</Text>{criando ? <Field icon={<User size={18} color={colors.textMuted} />} placeholder="Nome completo" value={fullName} onChangeText={setFullName} autoCapitalize="words" /> : null}<Field icon={<Mail size={18} color={colors.textMuted} />} placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><View style={styles.passwordRow}><Lock size={18} color={colors.textMuted} /><TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry={!showPassword} autoCapitalize="none" style={styles.input} /><Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={10}>{showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}</Pressable></View>{!criando ? <View style={styles.formLine}><Pressable onPress={() => setRemember((current) => !current)} style={styles.remember}><View style={[styles.checkbox, remember && styles.checkboxActive]} /> <Text variant="meta" color={colors.textSecondary}>Lembrar-me</Text></Pressable><Pressable onPress={() => router.push('/(auth)/recuperar-senha' as never)}><Text variant="meta" color={colors.brand}>Esqueci minha senha</Text></Pressable></View> : null}{error ? <View style={styles.errorBox}><Text variant="body" color={colors.dangerStrong}>{error}</Text></View> : null}<Button label={criando ? 'CRIAR CONTA' : 'ENTRAR'} icon={LogIn} onPress={() => { void handleSubmit(); }} loading={loading} /></Card><Pressable onPress={() => { setMode(criando ? 'entrar' : 'criar'); setError(null); }} style={styles.switch}><Text variant="body" color={colors.textSecondary}>{criando ? 'Já tem conta? ' : 'Não tem conta? '}<Text variant="bodyStrong" color={colors.brand}>{criando ? 'Entrar' : 'Cadastre-se'}</Text></Text></Pressable></View></ScrollView></KeyboardAvoidingView>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { icon: React.ReactNode };
function Field({ icon, ...props }: FieldProps) { return <View style={styles.field}>{icon}<TextInput style={styles.input} placeholderTextColor={colors.textMuted} selectionColor={colors.brand} {...props} /></View>; }

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bgApp }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, gap: spacing.xl }, hero: { alignItems: 'center', backgroundColor: colors.brandStrong, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.xs, overflow: 'hidden' }, brandMark: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, card: { gap: spacing.lg, marginTop: -spacing.md }, field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.slate50, paddingHorizontal: spacing.lg, minHeight: touch.minTarget }, passwordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.slate50, paddingHorizontal: spacing.lg, minHeight: touch.minTarget }, input: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, paddingVertical: spacing.md }, formLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 5 }, checkboxActive: { backgroundColor: colors.brand, borderColor: colors.brand }, errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }, switch: { alignItems: 'center', paddingVertical: spacing.sm } });
