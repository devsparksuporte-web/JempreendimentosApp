import { LogIn, Lock, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criando = mode === 'criar';

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    if (criando && !fullName.trim()) {
      setError('Informe seu nome.');
      return;
    }

    setLoading(true);
    try {
      if (criando) {
        await signUp(email, password, fullName);
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível continuar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.brand}>
            <View style={styles.brandBanner}>
              <Image
                source={require('../../../assets/images/brand/jempreendimentos-logo.png')}
                style={styles.brandImage}
                resizeMode="contain"
              />
            </View>
            <Text variant="screenTitle">JEmpreendimentos</Text>
            <Text variant="meta" color={colors.brand}>
              Climatização e assistência técnica
            </Text>
          </View>

          <Card>
            <View style={styles.form}>
              <Text variant="microLabel" color={colors.textSecondary}>
                {criando ? 'Criar conta' : 'Acessar conta'}
              </Text>

              {criando ? (
                <Field
                  icon={<User size={18} color={colors.textMuted} />}
                  placeholder="Nome completo"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              ) : null}

              <Field
                icon={<Mail size={18} color={colors.textMuted} />}
                placeholder="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Field
                icon={<Lock size={18} color={colors.textMuted} />}
                placeholder="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Text variant="body" color={colors.dangerStrong}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <Button
                label={criando ? 'Criar conta' : 'Entrar'}
                icon={LogIn}
                onPress={handleSubmit}
                loading={loading}
              />
            </View>
          </Card>

          <Pressable
            onPress={() => {
              setMode(criando ? 'entrar' : 'criar');
              setError(null);
            }}
            style={styles.switch}>
            <Text variant="body" color={colors.textSecondary}>
              {criando ? 'Já tem conta? ' : 'Ainda não tem conta? '}
              <Text variant="bodyStrong" color={colors.brand}>
                {criando ? 'Entrar' : 'Criar agora'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { icon: React.ReactNode };

function Field({ icon, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      {icon}
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.brand}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.xxl },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
  },
  brand: { alignItems: 'center', gap: spacing.xs },
  brandBanner: {
    width: '100%',
    height: 164,
    borderRadius: radius.xl,
    backgroundColor: colors.brandStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  brandImage: {
    width: '92%',
    height: 142,
  },
  form: { gap: spacing.lg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.slate50,
    paddingHorizontal: spacing.lg,
    minHeight: touch.minTarget,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  switch: { alignItems: 'center', paddingVertical: spacing.sm },
});
