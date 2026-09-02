import { CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/alerta';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/**
 * Trocar a senha sem ter esquecido dela.
 *
 * Antes disto só existia o "esqueci minha senha": quem quisesse trocar a
 * senha por vontade própria — porque contou para alguém, porque saiu da
 * equipe, porque desconfiou — precisava sair da conta e fingir que tinha
 * esquecido, esperando um email chegar.
 *
 * A senha atual é pedida de propósito. O `updateUser` do Supabase troca a
 * senha só com a sessão aberta, sem perguntar a antiga — o que significa
 * que qualquer pessoa diante de um tablet destravado e já logado poderia
 * tomar a conta do técnico. Conferir a senha atual antes fecha essa porta,
 * e é barato: uma tentativa de login com o email de quem já está aqui.
 */
export default function TrocarSenhaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const email = session?.user.email ?? '';

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tamanhoOk = nova.length >= 8;
  const maiusculaOk = /[A-Z]/.test(nova);
  const numeroOk = /[0-9]/.test(nova);
  const podeSalvar = !!atual && tamanhoOk && maiusculaOk && numeroOk && nova === confirmacao;

  async function salvar() {
    if (salvando) return;
    setErro(null);

    if (!tamanhoOk || !maiusculaOk || !numeroOk) {
      setErro('A senha deve ter 8 caracteres, uma letra maiúscula e um número.');
      return;
    }
    if (nova !== confirmacao) {
      setErro('As senhas não conferem.');
      return;
    }
    if (nova === atual) {
      setErro('A nova senha é igual à atual.');
      return;
    }
    if (!email) {
      setErro('Sessão sem email. Entre de novo.');
      return;
    }

    setSalvando(true);
    try {
      // Confere quem está do outro lado antes de deixar trocar.
      const { error: falhaAtual } = await supabase.auth.signInWithPassword({
        email,
        password: atual,
      });
      if (falhaAtual) {
        setErro('Senha atual incorreta.');
        return;
      }

      const { error: falhaNova } = await supabase.auth.updateUser({ password: nova });
      if (falhaNova) throw falhaNova;

      Alert.alert('Senha alterada', 'Use a nova senha no próximo acesso.');
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar a senha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title="Trocar senha"
        eyebrow="Segurança e acesso"
        onBack={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.pagina, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Card style={styles.cartao}>
          <View style={styles.selo}>
            <LockKeyhole size={22} color={colors.brand} />
            <Text variant="meta" color={colors.textSecondary} style={styles.seloTexto}>
              {email || 'Conta autenticada'}
            </Text>
          </View>

          <Campo
            label="Senha atual"
            value={atual}
            onChangeText={setAtual}
            visivel={visivel}
            onAlternar={() => setVisivel(!visivel)}
          />
          <Campo
            label="Nova senha"
            value={nova}
            onChangeText={setNova}
            visivel={visivel}
            onAlternar={() => setVisivel(!visivel)}
          />

          <View style={styles.requisitos}>
            <Requisito label="Mínimo 8 caracteres" ok={tamanhoOk} />
            <Requisito label="Pelo menos uma letra maiúscula" ok={maiusculaOk} />
            <Requisito label="Pelo menos um número" ok={numeroOk} />
          </View>

          <Campo
            label="Confirmar nova senha"
            value={confirmacao}
            onChangeText={setConfirmacao}
            visivel={visivel}
            onAlternar={() => setVisivel(!visivel)}
          />

          {erro ? (
            <Text variant="meta" color={colors.dangerStrong}>
              {erro}
            </Text>
          ) : null}

          <Button
            label="ALTERAR SENHA"
            icon={CheckCircle2}
            loading={salvando}
            disabled={!podeSalvar}
            onPress={() => {
              void salvar();
            }}
          />
        </Card>

        <Text variant="meta" color={colors.textMuted} style={styles.nota}>
          Esqueceu a senha atual? Saia da conta e use “Esqueci minha senha” na tela de acesso — o
          link chega no seu email.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({
  label,
  value,
  onChangeText,
  visivel,
  onAlternar,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  visivel: boolean;
  onAlternar: () => void;
}) {
  return (
    <View style={styles.campo}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {label}
      </Text>
      <View style={styles.entrada}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visivel}
          autoCapitalize="none"
          autoComplete="off"
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.brand}
          style={styles.input}
        />
        <Pressable
          onPress={onAlternar}
          accessibilityRole="button"
          accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          hitSlop={8}>
          {visivel ? (
            <EyeOff size={19} color={colors.textMuted} />
          ) : (
            <Eye size={19} color={colors.textMuted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Requisito({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.requisito}>
      <View style={[styles.marcador, ok && styles.marcadorOk]} />
      <Text variant="meta" color={ok ? colors.successStrong : colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bgApp },
  pagina: { padding: spacing.lg, gap: spacing.md },
  cartao: { gap: spacing.md },
  selo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  seloTexto: { flexShrink: 1 },
  campo: { gap: spacing.xs },
  entrada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSurface,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  requisitos: { gap: spacing.xs },
  requisito: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  marcador: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  marcadorOk: { backgroundColor: colors.success },
  nota: { paddingHorizontal: spacing.xs },
});
