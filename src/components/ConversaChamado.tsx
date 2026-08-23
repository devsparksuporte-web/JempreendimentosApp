import { Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/alerta';
import {
  assinarMensagens,
  enviarMensagem,
  fetchMensagens,
  type Mensagem,
} from '@/services/mensagens';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

/**
 * Conversa do chamado, a mesma para cliente, técnico e administração.
 *
 * Uma tela só para os três porque a conversa é uma só: a RLS já garante
 * que ninguém vê o chamado dos outros, e duplicar isso em três telas seria
 * três lugares para esquecer de corrigir.
 */
export function ConversaChamado({ callId }: { callId: string }) {
  const { session } = useAuth();
  const eu = session?.user.id ?? null;

  const [itens, setItens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Guarda o que já está na tela para o realtime não duplicar a própria
  // mensagem, que chega pelo insert e de novo pelo canal.
  const vistos = useRef<Set<string>>(new Set());

  const juntar = useCallback((nova: Mensagem) => {
    if (vistos.current.has(nova.id)) return;
    vistos.current.add(nova.id);
    setItens((atual) => [...atual, nova]);
  }, []);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const lista = await fetchMensagens(callId);
        if (!ativo) return;
        vistos.current = new Set(lista.map((m) => m.id));
        setItens(lista);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    const cancelar = assinarMensagens(callId, juntar);
    return () => {
      ativo = false;
      cancelar();
    };
  }, [callId, juntar]);

  async function enviar() {
    const corpo = texto.trim();
    if (!corpo || enviando) return;

    setEnviando(true);
    try {
      const nova = await enviarMensagem(callId, corpo);
      juntar(nova);
      setTexto('');
    } catch (e) {
      Alert.alert('Não foi possível enviar', e instanceof Error ? e.message : '');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.raiz}>
      <Text variant="microLabel" color={colors.textSecondary}>
        Conversa do chamado
      </Text>

      <Card style={styles.cartao}>
        {carregando ? (
          <ActivityIndicator color={colors.brand} />
        ) : erro ? (
          <Text variant="meta" color={colors.dangerStrong}>
            {erro}
          </Text>
        ) : itens.length === 0 ? (
          <Text variant="meta" color={colors.textMuted}>
            Nenhuma mensagem ainda. O que for escrito aqui fica no histórico do chamado — diferente
            do que se combina por telefone.
          </Text>
        ) : (
          <View style={styles.linhas}>
            {itens.map((m) => {
              const minha = !!eu && m.sender_id === eu;
              return (
                <View key={m.id} style={[styles.balaoLinha, minha && styles.balaoLinhaMinha]}>
                  <View style={[styles.balao, minha ? styles.balaoMeu : styles.balaoOutro]}>
                    <Text
                      variant="meta"
                      color={minha ? colors.brandSoft : colors.textMuted}
                      style={styles.autor}>
                      {minha ? 'Você' : m.author_side === 'cliente' ? 'Cliente' : 'Equipe'}
                      {' · '}
                      {new Date(m.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text variant="body" color={minha ? colors.textOnBrand : colors.textPrimary}>
                      {m.body}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.envio}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escreva uma mensagem"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.brand}
            multiline
            style={styles.campo}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
            onPress={() => {
              void enviar();
            }}
            disabled={enviando || !texto.trim()}
            style={({ pressed }) => [
              styles.botao,
              (!texto.trim() || enviando) && styles.botaoInativo,
              pressed && styles.pressionado,
            ]}>
            {enviando ? (
              <ActivityIndicator size="small" color={colors.textOnBrand} />
            ) : (
              <Send size={18} color={colors.textOnBrand} />
            )}
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: spacing.md },
  cartao: { gap: spacing.md },

  linhas: { gap: spacing.sm },
  balaoLinha: { flexDirection: 'row' },
  balaoLinhaMinha: { justifyContent: 'flex-end' },
  balao: { maxWidth: '86%', borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  balaoMeu: { backgroundColor: colors.brand, borderBottomRightRadius: radius.sm },
  balaoOutro: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  autor: { marginBottom: 2 },

  envio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.md,
  },
  campo: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.slate50,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  botao: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoInativo: { backgroundColor: colors.slate300 },
  pressionado: { opacity: 0.85 },
});
