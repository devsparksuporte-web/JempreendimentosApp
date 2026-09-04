import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme/tokens';

/**
 * Rodapé fixo do sistema na web: conexão, versão e assinatura.
 *
 * O indicador de conexão é de verdade — ouve os eventos `online`/`offline`
 * do navegador. Bolinha verde acesa por decoração é pior que nenhuma: a
 * pessoa aprende a confiar nela e não descobre quando cai.
 *
 * A versão sai da config do Expo, não de um número digitado aqui, senão ela
 * envelhece no primeiro build em que alguém esquecer de trocar.
 */

const VERSAO = Constants.expoConfig?.version ?? '—';

/** Nome em inglês porque a regra dos hooks exige o prefixo `use`. */
function useConexao(): boolean {
  // O primeiro valor vem do próprio navegador, não de um `true` otimista que
  // depois seria corrigido dentro do efeito.
  const [online, setOnline] = useState(
    () => Platform.OS !== 'web' || typeof window === 'undefined' || window.navigator.onLine,
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const marcar = () => setOnline(window.navigator.onLine);
    window.addEventListener('online', marcar);
    window.addEventListener('offline', marcar);
    return () => {
      window.removeEventListener('online', marcar);
      window.removeEventListener('offline', marcar);
    };
  }, []);

  return online;
}

export function RodapeDoSistema() {
  const online = useConexao();

  return (
    <View style={styles.rodape}>
      <View style={styles.estado}>
        <View style={[styles.bolinha, online ? styles.ligado : styles.desligado]} />
        <Text variant="meta" color={colors.textSecondary}>
          {online ? 'Conexão ativa' : 'Sem conexão com a internet'}
        </Text>
      </View>

      <Text variant="meta" color={colors.textMuted}>
        JEmpreendimentos · versão {VERSAO}
      </Text>

      <Text variant="meta" color={colors.textMuted} style={styles.assinatura}>
        © 2026 DevSpark Web
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
    height: 40,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  estado: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bolinha: { width: 8, height: 8, borderRadius: 4 },
  ligado: { backgroundColor: colors.successStrong },
  desligado: { backgroundColor: colors.dangerStrong },
  assinatura: { marginLeft: 'auto' },
});
