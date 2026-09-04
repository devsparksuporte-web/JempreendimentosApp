import { useRouter } from 'expo-router';
import { LogOut, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { SinoNotificacoes } from '@/components/ui/SinoNotificacoes';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { fotoOuBoneco } from '@/services/perfil';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Cabeçalho fixo do sistema na web: avisos e menu do usuário.
 *
 * Fica no layout do grupo, acima do conteúdo — não dentro de cada tela.
 * Assim ele não pisca a cada navegação e continua no lugar quando a pessoa
 * troca de página, que é o que separa um sistema de um site.
 *
 * A busca global saiu daqui a pedido. O serviço `@/services/busca` continua
 * no projeto, pronto para voltar em outro lugar, em vez de ser reescrito do
 * zero se a busca fizer falta.
 */

const ROTULO_PAPEL: Record<string, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  cliente: 'Cliente',
};

export function BarraSuperior() {
  const router = useRouter();
  const { profile, role, signOut } = useAuth();

  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <View style={styles.barra}>
      <View style={styles.acoes}>
        <SinoNotificacoes />

        <Pressable
          onPress={() => setMenuAberto((a) => !a)}
          accessibilityRole="button"
          accessibilityLabel="Menu do usuário"
          style={({ pressed }) => [styles.usuario, pressed && styles.tocado]}>
          <Image
            source={{ uri: fotoOuBoneco(profile?.avatar_url, profile?.full_name ?? 'J') }}
            style={styles.avatar}
          />
          <View style={styles.usuarioTextos}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {profile?.full_name || 'Minha conta'}
            </Text>
            <Text variant="meta" color={colors.textMuted}>
              {ROTULO_PAPEL[role ?? ''] ?? 'Usuário'}
            </Text>
          </View>
        </Pressable>
      </View>

      {menuAberto ? (
        <>
          <Pressable style={styles.fundo} onPress={() => setMenuAberto(false)} />
          <View style={styles.menu}>
            <Pressable
              onPress={() => {
                setMenuAberto(false);
                router.push('/editar-perfil' as never);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.tocado]}>
              <UserRound size={17} color={colors.textSecondary} />
              <Text variant="body">Meu perfil</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuAberto(false);
                void signOut();
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.tocado]}>
              <LogOut size={17} color={colors.dangerStrong} />
              <Text variant="body" color={colors.dangerStrong}>
                Sair da conta
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    height: 68,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 40,
  },

  acoes: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginLeft: 'auto' },
  usuario: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 220 },
  usuarioTextos: { gap: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgApp },
  tocado: { opacity: 0.85 },

  fundo: { position: 'absolute', inset: 0, top: 68, height: 4000, zIndex: 30 },

  menu: {
    position: 'absolute',
    top: 62,
    right: spacing.lg,
    zIndex: 50,
    minWidth: 220,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.brandStrong,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
