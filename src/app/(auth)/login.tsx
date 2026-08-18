import { ArrowRight, Eye, EyeOff, Lock, Mail, User, Wind } from 'lucide-react-native';
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

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled"><View style={[styles.hero, { paddingTop: insets.top + spacing.xxl }]}><View style={styles.decorTop} /><View style={styles.decorBottom} /><View style={styles.heroContent}><View style={styles.iconTile}><Wind size={38} color={colors.textOnBrand} strokeWidth={1.8} /></View><Text variant="screenTitle" color={colors.textOnBrand} style={styles.brandTitle}>JEMPREENDIMENTOS</Text><Text variant="microLabel" color={colors.slate200} style={styles.brandSubtitle}>GESTÃO DE SERVIÇOS</Text></View></View><View style={styles.main}><Card style={styles.formCard}><Text variant="screenTitle" color={colors.brandStrong}>Acesse sua conta</Text>{criando ? <Field label="Nome completo" icon={<User size={19} color={colors.textMuted} />} placeholder="Seu nome" value={fullName} onChangeText={setFullName} autoCapitalize="words" /> : null}<Field label="Email ou Usuário" icon={<Mail size={19} color={colors.textMuted} />} placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><View style={styles.fieldGroup}><Text variant="microLabel" color={colors.textSecondary}>Senha</Text><View style={styles.inputGroup}><Lock size={19} color={colors.textMuted} /><TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.slate300} secureTextEntry={!showPassword} autoCapitalize="none" style={styles.input} /><Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={10} style={styles.eyeButton}>{showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}</Pressable></View></View>{!criando ? <View style={styles.options}><Pressable onPress={() => setRemember((current) => !current)} style={styles.remember}><View style={[styles.checkbox, remember && styles.checkboxChecked]} /><Text variant="meta" color={colors.textSecondary}>Lembrar-me</Text></Pressable><Pressable onPress={() => router.push('/(auth)/recuperar-senha' as never)}><Text variant="meta" color={colors.brand}>Esqueci minha senha</Text></Pressable></View> : null}{error ? <View style={styles.errorBox}><Text variant="body" color={colors.dangerStrong}>{error}</Text></View> : null}<View style={styles.submitWrap}><Button label={criando ? 'CRIAR CONTA' : 'ENTRAR'} icon={ArrowRight} onPress={() => { void handleSubmit(); }} loading={loading} /></View></Card><View style={styles.footer}><Pressable onPress={() => { setMode(criando ? 'entrar' : 'criar'); setError(null); }}><Text variant="body" color={colors.textSecondary}>{criando ? 'Já tem conta? ' : 'Não tem conta? '}<Text variant="bodyStrong" color={colors.brand}>{criando ? 'Entrar' : 'Cadastre-se'}</Text></Text></Pressable><View style={styles.copyright}><Text variant="microLabel" color={colors.textMuted}>© 2025 JEMPREENDIMENTOS</Text><View style={styles.footerLine} /></View></View></View></ScrollView></KeyboardAvoidingView>;
}

type FieldProps = React.ComponentProps<typeof TextInput> & { icon: React.ReactNode; label: string };
function Field({ icon, label, ...props }: FieldProps) { return <View style={styles.fieldGroup}><Text variant="microLabel" color={colors.textSecondary}>{label}</Text><View style={styles.inputGroup}>{icon}<TextInput style={styles.input} placeholderTextColor={colors.slate300} selectionColor={colors.brand} {...props} /></View></View>; }

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bgApp }, page: { flexGrow: 1 }, hero: { minHeight: 330, backgroundColor: colors.brandStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: layout.screenPadding, paddingBottom: spacing.xxl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden', position: 'relative' }, heroContent: { alignItems: 'center', zIndex: 2, gap: spacing.sm }, iconTile: { width: 80, height: 80, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, brandTitle: { fontSize: 30, lineHeight: 36, fontFamily: fonts.extrabold, letterSpacing: -0.5 }, brandSubtitle: { letterSpacing: 2.2 }, decorTop: { position: 'absolute', width: 270, height: 270, borderRadius: 135, backgroundColor: 'rgba(255,255,255,0.05)', top: -125, right: -85 }, decorBottom: { position: 'absolute', width: 270, height: 270, borderRadius: 135, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -155, left: -105 }, main: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.screenPadding, marginTop: -42, zIndex: 3 }, formCard: { borderRadius: 32, padding: spacing.xl, gap: spacing.lg, shadowColor: colors.brandStrong, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 }, fieldGroup: { gap: spacing.sm }, inputGroup: { height: 56, width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl }, input: { flex: 1, height: '100%', color: colors.textPrimary, fontFamily: fonts.medium, fontSize: 14 }, eyeButton: { padding: spacing.xs }, options: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.xs }, remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSurface }, checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand }, errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md }, submitWrap: { paddingTop: spacing.sm }, footer: { alignItems: 'center', gap: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl }, copyright: { alignItems: 'center', gap: spacing.sm, opacity: 0.55 }, footerLine: { width: 32, height: 4, borderRadius: radius.pill, backgroundColor: colors.slate300 }, });
