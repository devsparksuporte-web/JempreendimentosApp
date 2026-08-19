import { useRouter } from 'expo-router';
import { ChevronRight, MessageCircle, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { formatTime } from '@/lib/format';
import {
  fetchConversas,
  formatarTelefone,
  iniciaisDe,
  resumirConversas,
  type ConversaWhatsapp,
} from '@/services/whatsapp';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type Filtro = 'todas' | 'nao_cadastrados' | 'triagem' | 'aguardando' | 'resolvidas';

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'nao_cadastrados', rotulo: 'Não cadastrados' },
  { chave: 'triagem', rotulo: 'Em triagem' },
  { chave: 'aguardando', rotulo: 'Aguardando' },
  { chave: 'resolvidas', rotulo: 'Resolvidas' },
];

function combina(c: ConversaWhatsapp, filtro: Filtro): boolean {
  if (filtro === 'todas') return true;
  if (filtro === 'nao_cadastrados') return !c.clienteId;
  if (filtro === 'aguardando') return c.aberta && c.aguardandoResposta && !c.chamado;
  if (filtro === 'triagem') return c.aberta && !c.aguardandoResposta && !c.chamado;
  return Boolean(c.chamado) || !c.aberta;
}

export default function AdminWhatsappScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [conversas, setConversas] = useState<ConversaWhatsapp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const load = useCallback(async () => {
    setError(null);
    try {
      setConversas(await fetchConversas());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar as conversas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resumo = useMemo(() => resumirConversas(conversas), [conversas]);
  const filtradas = useMemo(
    () => conversas.filter((c) => combina(c, filtro)),
    [conversas, filtro],
  );

  return (
    <View style={styles.root}>
      <Header
        title="WhatsApp"
        eyebrow="Operação · Atendimento"
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar"
            onPress={load}
            style={styles.refresh}>
            <RefreshCw size={18} color={colors.brand} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }>
        <View style={styles.container}>
          {/* Os três números do topo do design. */}
          <View style={styles.resumo}>
            <ResumoBloco
              rotulo="Aguardando resposta"
              valor={resumo.aguardando}
              cor={colors.warningStrong}
            />
            <ResumoBloco rotulo="Em triagem" valor={resumo.emTriagem} cor={colors.aiStrong} />
            <ResumoBloco
              rotulo="Viraram chamado hoje"
              valor={resumo.viraramChamado}
              cor={colors.successStrong}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtros}>
            {FILTROS.map((f) => {
              const ativo = filtro === f.chave;
              return (
                <Pressable
                  key={f.chave}
                  onPress={() => setFiltro(f.chave)}
                  style={[styles.filtro, ativo ? styles.filtroAtivo : styles.filtroInativo]}>
                  <Text
                    variant="microLabel"
                    color={ativo ? colors.textOnBrand : colors.textSecondary}>
                    {f.rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.tituloLista}>
            <Text variant="microLabel" color={colors.textSecondary}>
              Conversas recentes
            </Text>
            <Badge label={String(filtradas.length)} tone="info" />
          </View>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : conversas.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Nenhuma conversa recebida"
              description="As conversas aparecem aqui quando o webhook da API do WhatsApp Business estiver ligado a este projeto."
            />
          ) : filtradas.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary} style={styles.centro}>
                Nenhuma conversa neste filtro.
              </Text>
            </Card>
          ) : (
            filtradas.map((c) => (
              <Pressable
                key={c.id}
                disabled={!c.chamado}
                onPress={() =>
                  c.chamado && router.push(`/(admin)/chamado/${c.chamado.id}` as never)
                }
                style={({ pressed }) => [styles.conversa, pressed && styles.pressed]}>
                <View style={styles.avatar}>
                  <Text variant="bodyStrong" color={colors.brand}>
                    {iniciaisDe(c.clienteNome, c.telefone)}
                  </Text>
                </View>

                <View style={styles.conversaTextos}>
                  <View style={styles.conversaTopo}>
                    <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                      {c.clienteNome ?? formatarTelefone(c.telefone)}
                    </Text>
                    <Text variant="meta" color={colors.textMuted}>
                      {c.ultimaMensagemEm ? formatTime(c.ultimaMensagemEm) : ''}
                    </Text>
                  </View>

                  <Text variant="meta" color={colors.textSecondary} numberOfLines={1}>
                    {c.ultimaMensagem ?? formatarTelefone(c.telefone)}
                  </Text>

                  <View style={styles.selos}>
                    {!c.clienteId ? <Badge label="Não cadastrado" tone="warning" /> : null}
                    {c.chamado ? (
                      <Badge label={`Chamado #${c.chamado.code}`} tone="success" />
                    ) : c.aguardandoResposta ? (
                      <Badge label="Aguardando resposta" tone="warning" />
                    ) : (
                      <Badge label="Em triagem" tone="ai" />
                    )}
                  </View>
                </View>

                {c.chamado ? <ChevronRight size={18} color={colors.slate300} /> : null}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ResumoBloco({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <View style={styles.resumoBloco}>
      <Text variant="microLabel" color={colors.textSecondary}>
        {rotulo}
      </Text>
      <Text variant="kpi" color={cor}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  centro: { textAlign: 'center' },

  resumo: { flexDirection: 'row', gap: spacing.md },
  resumoBloco: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.xs,
  },

  filtros: { gap: spacing.sm, paddingVertical: 2 },
  filtro: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filtroAtivo: { backgroundColor: colors.brand, borderColor: colors.brand },
  filtroInativo: { backgroundColor: colors.bgSurface, borderColor: colors.border },

  tituloLista: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },

  conversa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversaTextos: { flex: 1, gap: spacing.xs },
  conversaTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },

  refresh: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
