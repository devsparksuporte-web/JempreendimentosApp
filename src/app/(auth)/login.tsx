import { ArrowRight, Eye, EyeOff, Fingerprint, Lock, Mail, Snowflake, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { SplitComVento } from '@/components/Abertura';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import {
  biometriaDisponivel,
  entrarComBiometria,
  guardarAcesso,
  temAcessoGuardado,
} from '@/services/biometria';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

/**
 * Entrada do sistema.
 *
 * Fundo claro e logo em destaque, sem o painel azul escuro que existia
 * antes. A marca aparece uma vez, grande, e o resto da tela é o formulário —
 * é a primeira coisa que cliente e técnico veem, e o que eles precisam ali é
 * digitar duas linhas e entrar.
 *
 * Os flocos ao fundo são decoração e ficam com opacidade baixa de propósito:
 * precisam sumir atrás do texto, não competir com ele.
 */
export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Acima disso há espaço para duas colunas. Abaixo, é celular ou
  // tablet em pé, e empilhar continua sendo o certo.
  const { width } = useWindowDimensions();
  const emDuasColunas = width >= 900;
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comDigital, setComDigital] = useState(false);
  const criando = mode === 'criar';

  // A digital só aparece quando o aparelho tem leitor com digital cadastrada
  // E existe um acesso guardado. Oferecer o botão sem uma das duas coisas é
  // prometer um atalho que não funciona.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const [temLeitor, temGuardado] = await Promise.all([
        biometriaDisponivel(),
        temAcessoGuardado(),
      ]);
      if (ativo) setComDigital(temLeitor && temGuardado);
    })();
    return () => {
      ativo = false;
    };
  }, []);

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
        // Só guarda quando a pessoa pediu para lembrar. Sem isso, o próximo
        // que pegasse o aparelho entraria com a digital dele na conta dela.
        if (remember) await guardarAcesso();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível continuar.');
    } finally {
      setLoading(false);
    }
  }

  async function entrarPelaDigital() {
    setError(null);
    try {
      await entrarComBiometria();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível usar a digital.');
      setComDigital(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.pagina,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.miolo, emDuasColunas && styles.mioloLargo]}>
        <Snowflake size={26} color={colors.brand} style={[styles.floco, styles.floco1]} />
        <Snowflake size={40} color={colors.brand} style={[styles.floco, styles.floco2]} />
        <Snowflake size={18} color={colors.brand} style={[styles.floco, styles.floco3]} />

        <View style={[styles.marca, emDuasColunas && styles.marcaLado]}>
          <Image
            source={require('@/assets/images/logo-j.png')}
            style={[styles.logo, emDuasColunas && styles.logoGrande]}
            resizeMode="contain"
            accessibilityLabel="JEmpreendimentos"
          />
          <Text variant="screenTitle" color={colors.brandStrong} style={styles.nome}>
            JEmpreendimentos
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            Gestão Inteligente de Climatização
          </Text>
          {emDuasColunas ? (
            <View style={styles.ilustracao}>
              <SplitComVento largura={220} />
            </View>
          ) : null}
        </View>

        <View style={styles.conteudo}>
          {criando ? (
            <Campo
              label="NOME COMPLETO"
              icone={<User size={19} color={colors.textMuted} />}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Seu nome"
              autoCapitalize="words"
            />
          ) : null}

          <Campo
            label="E-MAIL"
            icone={<Mail size={19} color={colors.textMuted} />}
            value={email}
            onChangeText={setEmail}
            placeholder="ex: voce@jempreendimento.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <View style={styles.grupo}>
            <Text variant="microLabel" color={colors.textSecondary}>
              SENHA
            </Text>
            <View style={styles.entrada}>
              <Lock size={19} color={colors.textMuted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.slate300}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPassword((atual) => !atual)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                {showPassword ? (
                  <EyeOff size={20} color={colors.textMuted} />
                ) : (
                  <Eye size={20} color={colors.textMuted} />
                )}
              </Pressable>
            </View>
          </View>

          {!criando ? (
            <View style={styles.opcoes}>
              <Pressable
                onPress={() => setRemember((atual) => !atual)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
                style={styles.lembrar}>
                <View style={[styles.caixa, remember && styles.caixaMarcada]} />
                <Text variant="meta" color={colors.textSecondary}>
                  Lembrar acesso
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push('/(auth)/recuperar-senha' as never)}>
                <Text variant="meta" color={colors.brand}>
                  Esqueci a senha
                </Text>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <View style={styles.erro}>
              <Text variant="body" color={colors.dangerStrong}>
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            label={criando ? 'CRIAR CONTA' : 'ENTRAR'}
            icon={ArrowRight}
            loading={loading}
            onPress={() => {
              void handleSubmit();
            }}
          />

          <Pressable
            onPress={() => {
              setMode(criando ? 'entrar' : 'criar');
              setError(null);
            }}
            style={styles.alternar}>
            <Text variant="body" color={colors.textSecondary}>
              {criando ? 'Já tem conta? ' : 'Não tem conta? '}
              <Text variant="bodyStrong" color={colors.brand}>
                {criando ? 'Entrar' : 'Cadastre-se'}
              </Text>
            </Text>
          </Pressable>
          {comDigital && !criando ? (
            <View style={styles.biometria}>
              <View style={styles.divisor}>
                <View style={styles.linha} />
                <Text variant="microLabel" color={colors.textMuted}>
                  OU USE SUA BIOMETRIA
                </Text>
                <View style={styles.linha} />
              </View>
              <Pressable
                onPress={() => {
                  void entrarPelaDigital();
                }}
                accessibilityRole="button"
                accessibilityLabel="Entrar com a digital"
                style={({ pressed }) => [styles.digital, pressed && styles.digitalTocada]}>
                <Fingerprint size={30} color={colors.brand} />
              </Pressable>
            </View>
          ) : null}
        </View>

        </View>

        <View style={styles.rodape}>
          <Text variant="microLabel" color={colors.textMuted}>
            © 2026 JEMPREENDIMENTOS
          </Text>
          <Text variant="microLabel" color={colors.textMuted}>
            Desenvolvido por DevSpark Web
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({
  label,
  icone,
  ...resto
}: React.ComponentProps<typeof TextInput> & { label: string; icone: React.ReactNode }) {
  return (
    <View style={styles.grupo}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {label}
      </Text>
      <View style={styles.entrada}>
        {icone}
        <TextInput placeholderTextColor={colors.slate300} style={styles.input} {...resto} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bgApp },
  pagina: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },

  floco: { position: 'absolute', opacity: 0.09 },
  floco1: { top: 90, left: 28 },
  floco2: { top: 190, right: 24 },
  floco3: { top: 320, left: 46 },

  miolo: { width: '100%', alignItems: 'center', gap: spacing.xl },
  mioloLargo: {
    flexDirection: 'row',
    // Cresce para ocupar a altura livre; com isso o `alignItems` centraliza
    // as duas colunas na vertical em vez de deixá-las grudadas no topo.
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 72,
    maxWidth: 1080,
  },
  marca: { alignItems: 'center', gap: spacing.xs },
  marcaLado: { flex: 1, maxWidth: 420 },
  logoGrande: { width: 176, height: 176 },
  ilustracao: { marginTop: spacing.xl },
  logo: { width: 132, height: 132 },
  nome: { marginTop: spacing.sm },

  conteudo: {
    width: '100%',
    maxWidth: layout.maxFormWidth,
    gap: spacing.md,
  },

  grupo: { gap: spacing.xs },
  entrada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },

  opcoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lembrar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  caixa: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  caixaMarcada: { backgroundColor: colors.brand, borderColor: colors.brand },

  erro: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  alternar: { alignItems: 'center', paddingVertical: spacing.sm },
  biometria: { alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  divisor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'stretch' },
  linha: { flex: 1, height: 1, backgroundColor: colors.border },
  digital: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  digitalTocada: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  rodape: { marginTop: 'auto', paddingTop: spacing.lg, alignItems: 'center', gap: 2 },
});
