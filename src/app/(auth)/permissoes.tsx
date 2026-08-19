import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  Images,
  MapPin,
  Settings,
  ShieldCheck,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import {
  abrirConfiguracoes,
  CATALOGO,
  concluirAssistentePermissoes,
  consultarTodas,
  solicitar,
  type ChavePermissao,
  type StatusPermissao,
} from '@/lib/permissoes';
import { colors, elevation, layout, radius, spacing } from '@/theme/tokens';

const ICONES: Record<ChavePermissao, typeof Camera> = {
  camera: Camera,
  localizacao: MapPin,
  midia: Images,
};

const ROTULO_STATUS: Record<StatusPermissao, string> = {
  pendente: 'Pendente',
  permitido: 'Permitido',
  negado: 'Negado',
  bloqueado: 'Bloqueado',
};

function coresDoStatus(status: StatusPermissao) {
  if (status === 'permitido') {
    return { fundo: colors.successSoft, texto: colors.successStrong, borda: colors.successSoft };
  }
  if (status === 'bloqueado') {
    return { fundo: colors.dangerSoft, texto: colors.dangerStrong, borda: colors.dangerSoft };
  }
  if (status === 'negado') {
    return { fundo: colors.warningSoft, texto: colors.warningStrong, borda: colors.warningSoft };
  }
  return { fundo: colors.slate100, texto: colors.textSecondary, borda: colors.border };
}

export default function PermissoesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<Record<ChavePermissao, StatusPermissao> | null>(null);
  /** Índice do item sendo solicitado; null quando estamos na lista. */
  const [passo, setPasso] = useState<number | null>(null);
  const [pedindo, setPedindo] = useState(false);

  const revisar = useCallback(async () => {
    setStatus(await consultarTodas());
  }, []);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  // Quem sai para as configurações do Android e volta precisa ver o status
  // novo sem ter de reiniciar o app.
  useEffect(() => {
    const inscricao = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void revisar();
    });
    return () => inscricao.remove();
  }, [revisar]);

  async function concluir() {
    await concluirAssistentePermissoes();
    router.replace('/(auth)/login');
  }

  /** Avança até o próximo item que ainda precisa de resposta. */
  function proximoPendente(apartirDe: number): number | null {
    if (!status) return null;
    for (let i = apartirDe; i < CATALOGO.length; i += 1) {
      if (status[CATALOGO[i].chave] !== 'permitido') return i;
    }
    return null;
  }

  async function pedir(indice: number) {
    const item = CATALOGO[indice];
    setPedindo(true);
    try {
      const resultado = await solicitar(item.chave);
      setStatus((atual) => (atual ? { ...atual, [item.chave]: resultado } : atual));
    } finally {
      setPedindo(false);
    }
  }

  if (!status) {
    return <View style={styles.root} />;
  }

  // ---------------------------------------------------------------------
  // Passo a passo: uma permissão por vez, nunca todas de uma vez
  // ---------------------------------------------------------------------
  if (passo !== null) {
    const item = CATALOGO[passo];
    const atual = status[item.chave];
    const Icone = ICONES[item.chave];
    const cores = coresDoStatus(atual);

    function seguir() {
      const proximo = proximoPendente(passo! + 1);
      setPasso(proximo);
    }

    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.passoConteudo,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}>
          <View style={styles.passoIcone}>
            <Icone size={40} color={colors.brand} />
          </View>

          <Text variant="screenTitle" style={styles.centro}>
            {item.titulo}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.centro}>
            {item.motivo}
          </Text>

          <View style={[styles.selo, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
            <Text variant="microLabel" color={cores.texto}>
              {ROTULO_STATUS[atual]}
            </Text>
          </View>

          {atual === 'permitido' ? (
            <View style={styles.acoes}>
              <Button label="Continuar" icon={ArrowRight} onPress={seguir} />
            </View>
          ) : atual === 'bloqueado' ? (
            <>
              <View style={styles.aviso}>
                <AlertCircle size={20} color={colors.dangerStrong} />
                <Text variant="body" color={colors.textSecondary} style={styles.flex}>
                  Para habilitar esta permissão, abra as configurações do aplicativo. O Android não
                  permite mais perguntar por aqui.
                </Text>
              </View>
              <View style={styles.acoes}>
                <Button
                  label="Abrir configurações"
                  icon={Settings}
                  onPress={() => {
                    void abrirConfiguracoes();
                  }}
                />
                <Button label="Continuar assim mesmo" variant="secondary" onPress={seguir} />
              </View>
            </>
          ) : atual === 'negado' ? (
            <>
              <View style={styles.aviso}>
                <AlertCircle size={20} color={colors.warningStrong} />
                <Text variant="body" color={colors.textSecondary} style={styles.flex}>
                  Você negou esta permissão. {item.consequencia}
                </Text>
              </View>
              <View style={styles.acoes}>
                <Button
                  label="Permitir novamente"
                  loading={pedindo}
                  onPress={() => {
                    void pedir(passo!);
                  }}
                />
                <Button label="Continuar" variant="secondary" onPress={seguir} />
              </View>
            </>
          ) : (
            <View style={styles.acoes}>
              <Button
                label={`Permitir ${item.titulo.toLowerCase()}`}
                loading={pedindo}
                onPress={() => {
                  void pedir(passo!);
                }}
              />
              <Button label="Agora não" variant="secondary" onPress={seguir} />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---------------------------------------------------------------------
  // Lista: o panorama antes de começar
  // ---------------------------------------------------------------------
  const pendentes = CATALOGO.filter((i) => status[i.chave] !== 'permitido').length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.conteudo,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <View style={styles.marca}>
          <View style={styles.marcaIcone}>
            <ShieldCheck size={30} color={colors.textOnBrand} />
          </View>
          <Text variant="screenTitle" style={styles.centro}>
            Vamos preparar seu acesso
          </Text>
          <Text variant="body" color={colors.textSecondary} style={styles.centro}>
            Para oferecer todos os recursos do aplicativo, precisamos configurar algumas
            permissões. Você decide cada uma, e pode mudar de ideia depois.
          </Text>
        </View>

        <View style={styles.lista}>
          {CATALOGO.map((item) => {
            const atual = status[item.chave];
            const Icone = ICONES[item.chave];
            const cores = coresDoStatus(atual);
            return (
              <View key={item.chave} style={styles.item}>
                <View style={styles.itemIcone}>
                  <Icone size={22} color={colors.brand} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{item.titulo}</Text>
                  <Text variant="meta" color={colors.textSecondary}>
                    {item.resumo}
                  </Text>
                </View>
                <View
                  style={[styles.selo, { backgroundColor: cores.fundo, borderColor: cores.borda }]}>
                  {atual === 'permitido' ? (
                    <Check size={13} color={cores.texto} strokeWidth={3} />
                  ) : null}
                  <Text variant="meta" color={cores.texto}>
                    {ROTULO_STATUS[atual]}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text variant="meta" color={colors.textMuted} style={styles.centro}>
          Nenhuma permissão é obrigatória para entrar. O aplicativo funciona sem elas, com os
          recursos correspondentes desligados.
        </Text>

        <View style={styles.acoes}>
          {pendentes > 0 ? (
            <Button
              label="Configurar permissões"
              icon={ArrowRight}
              onPress={() => setPasso(proximoPendente(0))}
            />
          ) : null}
          <Button
            label={pendentes > 0 ? 'Pular por enquanto' : 'Continuar'}
            variant={pendentes > 0 ? 'secondary' : 'primary'}
            onPress={() => {
              void concluir();
            }}
          />
        </View>

        {passoConcluido(status) ? (
          <Pressable
            onPress={() => {
              void concluir();
            }}
            style={styles.atalho}>
            <Text variant="meta" color={colors.brand}>
              Tudo pronto — entrar no aplicativo
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function passoConcluido(status: Record<ChavePermissao, StatusPermissao>): boolean {
  return CATALOGO.every((i) => status[i.chave] === 'permitido');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgApp },
  centro: { textAlign: 'center' },
  flex: { flex: 1, gap: 2 },

  conteudo: {
    width: '100%',
    maxWidth: layout.maxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
  },

  marca: { alignItems: 'center', gap: spacing.md },
  marcaIcone: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lista: { gap: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...elevation.card,
  },
  itemIcone: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  passoConteudo: {
    width: '100%',
    maxWidth: layout.maxFormWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  passoIcone: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  acoes: { alignSelf: 'stretch', gap: spacing.md },
  atalho: { alignSelf: 'center', padding: spacing.md },
});
