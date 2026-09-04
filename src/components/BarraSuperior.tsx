import { useRouter } from 'expo-router';
import { LogOut, Search, UserRound, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SinoNotificacoes } from '@/components/ui/SinoNotificacoes';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import {
  agruparResultados,
  buscarGlobal,
  MINIMO_PARA_BUSCAR,
  ROTULO_TIPO,
  type Resultado,
} from '@/services/busca';
import { fotoOuBoneco } from '@/services/perfil';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/**
 * Cabeçalho fixo do sistema na web: busca global, avisos e menu do usuário.
 *
 * Fica no layout do grupo, acima do conteúdo — não dentro de cada tela.
 * Assim ele não pisca a cada navegação e continua no lugar quando a pessoa
 * troca de página, que é o que separa um sistema de um site.
 *
 * A busca é de verdade e consulta o banco. Caixa de busca que não busca é o
 * mesmo problema do botão que abre "indisponível": ocupa espaço, promete
 * função e ensina a pessoa a não confiar na interface.
 */

const ROTULO_PAPEL: Record<string, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  cliente: 'Cliente',
};

/** Espera a digitação parar antes de consultar. */
const ESPERA_MS = 320;

export function BarraSuperior() {
  const router = useRouter();
  const { profile, role, signOut } = useAuth();

  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // Guarda o termo junto com o que ele achou. Assim "está buscando" e "o que
  // mostrar" são derivados de uma comparação, e não de estados paralelos que
  // precisariam ser zerados a cada tecla — o que obrigaria a mexer em estado
  // durante a renderização do efeito.
  const [achado, setAchado] = useState<{ termo: string; itens: Resultado[] }>({
    termo: '',
    itens: [],
  });
  const pedido = useRef(0);

  const alvo = termo.trim();
  const longoBastante = alvo.length >= MINIMO_PARA_BUSCAR;
  const buscando = longoBastante && achado.termo !== alvo;
  const resultados = achado.termo === alvo ? achado.itens : [];

  useEffect(() => {
    if (!longoBastante) return;
    const meu = ++pedido.current;
    const relogio = setTimeout(() => {
      void (async () => {
        const itens = await buscarGlobal(alvo);
        // Uma consulta lenta não pode sobrescrever o resultado de uma
        // digitação mais recente.
        if (pedido.current === meu) setAchado({ termo: alvo, itens });
      })();
    }, ESPERA_MS);
    return () => clearTimeout(relogio);
  }, [alvo, longoBastante]);

  function abrir(destino: string) {
    setTermo('');
    setAberto(false);
    router.push(destino as never);
  }

  const grupos = agruparResultados(resultados);
  const mostrarPainel = aberto && longoBastante;

  return (
    <View style={styles.barra}>
      <View style={styles.busca}>
        <Search size={17} color={colors.textMuted} />
        <TextInput
          value={termo}
          onChangeText={setTermo}
          onFocus={() => setAberto(true)}
          placeholder="Buscar chamado, cliente, equipamento ou peça"
          placeholderTextColor={colors.textMuted}
          style={styles.entrada}
          returnKeyType="search"
        />
        {termo ? (
          <Pressable onPress={() => setTermo('')} hitSlop={8} accessibilityLabel="Limpar busca">
            <X size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

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

      {mostrarPainel ? (
        <>
          <Pressable style={styles.fundo} onPress={() => setAberto(false)} />
          <View style={styles.painel}>
            {buscando ? (
              <View style={styles.aviso}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text variant="meta" color={colors.textMuted}>
                  Procurando…
                </Text>
              </View>
            ) : grupos.length === 0 ? (
              <View style={styles.aviso}>
                <Text variant="body" color={colors.textSecondary}>
                  Nada encontrado para “{alvo}”.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.lista} keyboardShouldPersistTaps="handled">
                {grupos.map((g) => (
                  <View key={g.tipo}>
                    <Text variant="microLabel" color={colors.textMuted} style={styles.grupo}>
                      {ROTULO_TIPO[g.tipo]}
                    </Text>
                    {g.itens.map((item) => (
                      <Pressable
                        key={`${item.tipo}-${item.id}`}
                        onPress={() => abrir(item.destino)}
                        style={({ pressed }) => [styles.item, pressed && styles.tocado]}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {item.titulo}
                        </Text>
                        <Text variant="meta" color={colors.textMuted} numberOfLines={1}>
                          {item.apoio}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
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
  busca: {
    flex: 1,
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgApp,
  },
  entrada: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    // O contorno do navegador some porque a borda do campo já marca o foco.
    outlineStyle: 'none' as never,
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

  painel: {
    position: 'absolute',
    top: 62,
    left: spacing.lg,
    zIndex: 50,
    width: 520,
    maxHeight: 420,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.brandStrong,
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  lista: { paddingVertical: spacing.xs },
  grupo: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  item: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 1 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
});
