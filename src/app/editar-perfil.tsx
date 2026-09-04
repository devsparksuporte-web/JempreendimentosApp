import { CheckCircle2, Mail, Phone, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FotoDePerfil } from '@/components/FotoDePerfil';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/alerta';
import { atualizarPerfil, telefoneBonito } from '@/services/perfil';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

/**
 * Editar o próprio perfil.
 *
 * Vale para cliente, técnico e administração: a política `profiles_update_self`
 * existe desde a 0001 e sempre permitiu isso — só faltava a tela. Antes, os
 * campos de nome e telefone tinham ícone de lápis que abria um aviso de
 * "indisponível", o que é pior que não ter o ícone.
 *
 * O email aparece, mas em leitura. Trocá-lo no Supabase dispara confirmação
 * nos dois endereços e, se algo falhar no meio, a pessoa fica sem acesso —
 * merece um fluxo próprio, com aviso, não um campo no meio de outros dois.
 */
export default function EditarPerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, refreshProfile } = useAuth();

  const [nome, setNome] = useState(profile?.full_name ?? '');
  const [telefone, setTelefone] = useState(telefoneBonito(profile?.phone));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudou =
    nome.trim() !== (profile?.full_name ?? '') ||
    telefone.replace(/\D/g, '') !== (profile?.phone ?? '').replace(/\D/g, '');

  async function salvar() {
    if (salvando) return;
    setErro(null);
    setSalvando(true);
    try {
      await atualizarPerfil({ nome, telefone });
      await refreshProfile();
      Alert.alert('Perfil atualizado', 'Seus dados foram salvos.');
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Meu perfil" eyebrow="Dados pessoais" onBack={() => router.back()} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.pagina, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Card style={styles.cartao}>
          <FotoDePerfil tamanho={104} />

          <Campo
            label="NOME COMPLETO"
            icone={<UserRound size={19} color={colors.textMuted} />}
            value={nome}
            onChangeText={setNome}
            placeholder="Seu nome"
            autoCapitalize="words"
          />

          <Campo
            label="TELEFONE"
            icone={<Phone size={19} color={colors.textMuted} />}
            value={telefone}
            onChangeText={(v) => setTelefone(telefoneBonito(v))}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
          />

          <View style={styles.grupo}>
            <Text variant="microLabel" color={colors.textSecondary}>
              EMAIL
            </Text>
            <View style={[styles.entrada, styles.entradaTravada]}>
              <Mail size={19} color={colors.textMuted} />
              <Text variant="body" color={colors.textSecondary} style={styles.flex} numberOfLines={1}>
                {session?.user.email ?? '—'}
              </Text>
            </View>
            <Text variant="meta" color={colors.textMuted}>
              O email é o seu acesso e não muda por aqui. Para trocá-lo, fale com a administração.
            </Text>
          </View>

          {erro ? (
            <Text variant="meta" color={colors.dangerStrong}>
              {erro}
            </Text>
          ) : null}

          <Button
            label="SALVAR"
            icon={CheckCircle2}
            loading={salvando}
            disabled={!mudou || nome.trim().length < 2}
            onPress={() => {
              void salvar();
            }}
          />
        </Card>
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
        <TextInput placeholderTextColor={colors.textMuted} style={styles.input} {...resto} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.bgApp },
  pagina: { padding: spacing.lg, alignItems: 'center' },
  cartao: { width: '100%', maxWidth: layout.maxFormWidth, gap: spacing.md },
  grupo: { gap: spacing.xs },
  flex: { flex: 1 },
  entrada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touch.minTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  entradaTravada: { backgroundColor: colors.bgApp },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
