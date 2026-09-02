import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import { MessageSquare, Navigation, Phone, Search, Users } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  estaAoVivo,
  fetchEquipeEmCampo,
  type TecnicoEmCampo,
} from '@/services/equipe';
import { D, elevacaoSuave } from '@/theme/paletaMapa';
import type { TechnicianStatus } from '@/types/database';

/**
 * Mapa de Técnicos.
 *
 * Implementação fiel ao design entregue: a paleta, os raios, a sombra e os
 * avatares vêm do HTML de referência, e não dos tokens do app — por decisão
 * do cliente, que pediu a tela igual ao enviado.
 */

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const CENTRO_PADRAO: [number, number] = [-47, -15];

// Sem esta linha o aplicativo FECHA ao abrir o mapa. O SDK nativo do Mapbox
// não avisa que falta token: ele lança MapboxConfigurationException no
// momento em que o MapView é inflado, e isso derruba o processo inteiro.
//
// A chamada existia só dentro do MapboxRouteMap. Quem passasse antes por uma
// rota de chamado carregava aquele módulo e o mapa daqui funcionava por
// tabela; quem viesse direto para cá levava o app ao chão. É o mesmo token,
// e configurá-lo é idempotente — repetir aqui é mais barato que depender da
// ordem em que as telas foram abertas.
Mapbox.setAccessToken(TOKEN ?? null);

type Filtro = 'todos' | TechnicianStatus;

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'disponivel', rotulo: 'Disponíveis' },
  { chave: 'em_atendimento', rotulo: 'Em Campo' },
  { chave: 'indisponivel', rotulo: 'Em Pausa' },
];

/** Cores de status exatamente como no design. */
function estilosDoStatus(status: TechnicianStatus) {
  if (status === 'disponivel') {
    return {
      ponto: D.esmeralda500,
      selo: { backgroundColor: D.esmeralda50, borderColor: D.esmeralda100 },
      texto: D.esmeralda600,
      rotulo: 'Disponível',
      esmaecido: false,
    };
  }
  if (status === 'indisponivel') {
    return {
      ponto: D.ambar500,
      selo: { backgroundColor: D.ambar50, borderColor: D.ambar100 },
      texto: D.ambar600,
      rotulo: 'Em Pausa',
      esmaecido: false,
    };
  }
  return {
    ponto: D.slate400,
    selo: { backgroundColor: D.slate100, borderColor: D.slate200 },
    texto: D.slate600,
    rotulo: 'Em Campo',
    esmaecido: true,
  };
}

/**
 * O design usa avatares do dicebear. O endpoint `/svg` não é renderizável
 * pelo <Image> do React Native, então usamos `/png` do mesmo serviço e com a
 * mesma semente — o desenho é idêntico.
 */
function avatarUrl(nome: string): string {
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(nome)}`;
}

/**
 * Ciclo de 2s com a curva `cubic-bezier(0.4, 0, 0.6, 1)` do design. Serve às
 * duas animações da tela: o `pin-pulse` dos marcadores e o `animate-pulse`
 * do ponto "Live" do cabeçalho.
 */
function useCicloPulso() {
  const valor = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, {
          toValue: 1,
          duration: 1000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
        Animated.timing(valor, {
          toValue: 0,
          duration: 1000,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [valor]);
  return valor;
}

/** Só dígitos: `tel:` e `whatsapp://` não aceitam máscara. */
function somenteDigitos(valor: string | null): string | null {
  const limpo = (valor ?? '').replace(/\D/g, '');
  return limpo.length >= 8 ? limpo : null;
}

export default function TecnicosScreen() {
  const insets = useSafeAreaInsets();
  const ciclo = useCicloPulso();

  /** `pin-pulse`: escala 1 -> 1.1 e opacidade 1 -> 0.8. */
  const pulsoPino = {
    transform: [{ scale: ciclo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
    opacity: ciclo.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }),
  };
  /** `animate-pulse` do Tailwind: opacidade 1 -> 0.5. */
  const pulsoLive = {
    opacity: ciclo.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
  };

  const [equipe, setEquipe] = useState<TecnicoEmCampo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEquipe(await fetchEquipeEmCampo());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a equipe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipe.filter((t) => {
      const porStatus = filtro === 'todos' || t.status === filtro;
      const porTexto =
        !termo ||
        t.nome.toLowerCase().includes(termo) ||
        (t.chamadoAtual?.cidade ?? '').toLowerCase().includes(termo);
      return porStatus && porTexto;
    });
  }, [equipe, busca, filtro]);

  const comPosicao = useMemo(() => filtrada.filter((t) => t.posicao), [filtrada]);
  const aoVivo = useMemo(() => equipe.filter((t) => estaAoVivo(t.posicao)).length, [equipe]);

  const limites = useMemo(() => {
    if (comPosicao.length < 2) return null;
    const lngs = comPosicao.map((t) => t.posicao!.longitude);
    const lats = comPosicao.map((t) => t.posicao!.latitude);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    };
  }, [comPosicao]);

  const foco = comPosicao.find((t) => t.id === selecionado) ?? comPosicao[0] ?? null;

  return (
    <View style={styles.raiz}>
      {/* Cabeçalho fixo com busca */}
      {/* `pt-14` do design (56px) já contava com a barra de status; aqui o
          inset entra no lugar dela para o respiro visual ficar igual. */}
      <View style={[styles.cabecalho, { paddingTop: Math.max(insets.top, 32) + 24 }]}>
        <View style={styles.cabecalhoTopo}>
          <Text style={styles.titulo}>Técnicos em Tempo Real</Text>
          <View style={styles.live}>
            <Animated.View style={[styles.liveDot, pulsoLive]} />
            <Text style={styles.liveTexto}>Live</Text>
          </View>
        </View>

        <View style={styles.busca}>
          <Search size={18} color={D.slate400} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar técnico por nome ou zona..."
            placeholderTextColor={D.slate400}
            style={styles.buscaInput}
          />
        </View>
      </View>

      <ScrollView
        style={styles.principal}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={D.azul900}
          />
        }>
        {/* Mapa */}
        <View style={styles.mapa}>
          {!TOKEN || comPosicao.length === 0 ? (
            <View style={styles.mapaVazio}>
              <Users size={28} color={D.slate300} />
              <Text style={styles.mapaVazioTitulo}>
                {TOKEN ? 'Nenhuma posição reportada' : 'Mapa indisponível'}
              </Text>
              <Text style={styles.mapaVazioTexto}>
                {TOKEN
                  ? 'Os técnicos aparecem aqui assim que o aplicativo deles enviar a localização.'
                  : 'Configure o token do Mapbox para exibir a equipe.'}
              </Text>
            </View>
          ) : (
            <>
              {/* O design põe o botão de navegação no canto inferior esquerdo,
                  que é onde o Mapbox desenha o logo e a atribuição. Como a
                  atribuição é exigência de licença e não pode sumir, quem se
                  muda é ela — para a direita, onde não há nada por cima. */}
              <MapView
                style={styles.mapaView}
                styleURL={Mapbox.StyleURL.Street}
                scaleBarEnabled={false}
                logoPosition={{ bottom: 8, right: 44 }}
                attributionPosition={{ bottom: 8, right: 8 }}>
                {limites ? (
                  <Camera
                    bounds={{
                      ne: limites.ne,
                      sw: limites.sw,
                      paddingTop: 60,
                      paddingBottom: 60,
                      paddingLeft: 60,
                      paddingRight: 60,
                    }}
                    animationDuration={700}
                  />
                ) : (
                  <Camera
                    zoomLevel={13}
                    centerCoordinate={
                      foco ? [foco.posicao!.longitude, foco.posicao!.latitude] : CENTRO_PADRAO
                    }
                    animationDuration={700}
                  />
                )}

                {comPosicao.map((t) => {
                  const s = estilosDoStatus(t.status);
                  return (
                    <MarkerView
                      key={t.id}
                      coordinate={[t.posicao!.longitude, t.posicao!.latitude]}
                      anchor={{ x: 0.5, y: 0.5 }}>
                      <Animated.View style={pulsoPino}>
                        <Pressable onPress={() => setSelecionado(t.id)} style={styles.pino}>
                          <Image source={{ uri: avatarUrl(t.nome) }} style={styles.pinoAvatar} />
                          <View style={[styles.pinoStatus, { backgroundColor: s.ponto }]} />
                        </Pressable>
                      </Animated.View>
                    </MarkerView>
                  );
                })}
              </MapView>

              {/* Botão de recentrar, canto inferior esquerdo */}
              <Pressable
                onPress={() => setSelecionado(null)}
                style={({ pressed }) => [styles.botaoMapa, pressed && styles.pressionado]}>
                <Navigation size={20} color={D.azul900} />
              </Pressable>
            </>
          )}
        </View>

        {/* Filtros */}
        <View style={styles.filtrosArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
            {FILTROS.map((f) => {
              const ativo = filtro === f.chave;
              return (
                <Pressable
                  key={f.chave}
                  onPress={() => setFiltro(f.chave)}
                  style={[styles.filtro, ativo ? styles.filtroAtivo : styles.filtroInativo]}>
                  <Text style={[styles.filtroTexto, { color: ativo ? D.branco : D.slate400 }]}>
                    {f.rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Lista */}
        <View style={[styles.lista, { paddingBottom: 128 + insets.bottom }]}>
          {loading ? (
            <Text style={styles.aviso}>Carregando equipe…</Text>
          ) : error ? (
            <Pressable onPress={load}>
              <Text style={styles.avisoErro}>{error} — toque para tentar novamente.</Text>
            </Pressable>
          ) : filtrada.length === 0 ? (
            <Text style={styles.aviso}>Nenhum técnico encontrado.</Text>
          ) : (
            filtrada.map((t) => {
              const s = estilosDoStatus(t.status);
              const telefone = somenteDigitos(t.telefone ?? t.whatsapp);
              const zap = somenteDigitos(t.whatsapp ?? t.telefone);
              return (
                <View key={t.id} style={[styles.cartao, s.esmaecido && styles.cartaoEsmaecido]}>
                  <View style={styles.avatarArea}>
                    <Image source={{ uri: avatarUrl(t.nome) }} style={styles.avatar} />
                    <View style={[styles.avatarStatus, { backgroundColor: s.ponto }]} />
                  </View>

                  <View style={styles.cartaoTextos}>
                    <Text style={styles.nome} numberOfLines={1}>
                      {t.nome}
                    </Text>
                    <Text style={styles.subtitulo} numberOfLines={1}>
                      {t.chamadoAtual
                        ? `${t.chamadoAtual.cidade ?? 'Em campo'} • OS#${t.chamadoAtual.code}`
                        : estaAoVivo(t.posicao)
                          ? 'Posição atual reportada'
                          : 'Sem posição recente'}
                    </Text>
                    <View style={[styles.selo, s.selo]}>
                      <Text style={[styles.seloTexto, { color: s.texto }]}>{s.rotulo}</Text>
                    </View>
                  </View>

                  <View style={styles.acoes}>
                    <Acao
                      icone={Phone}
                      rotulo={`Ligar para ${t.nome}`}
                      destino={telefone ? `tel:${telefone}` : null}
                    />
                    <Acao
                      icone={MessageSquare}
                      rotulo={`Mensagem para ${t.nome}`}
                      destino={
                        zap
                          ? `https://wa.me/${zap.startsWith('55') ? zap : `55${zap}`}`
                          : telefone
                            ? `sms:${telefone}`
                            : null
                      }
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Botão de contato do cartão. O ícone troca de cor ao ser pressionado, como o
 * `group-active:text-blue-900` do design. Sem número cadastrado o botão fica
 * inerte em vez de abrir um discador vazio.
 */
function Acao({
  icone: Icone,
  rotulo,
  destino,
}: {
  icone: typeof Phone;
  rotulo: string;
  destino: string | null;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={!destino}
      onPress={() => {
        if (destino) Linking.openURL(destino).catch(() => {});
      }}
      style={({ pressed }) => [
        styles.acao,
        pressed && styles.acaoPressionada,
        !destino && styles.acaoInerte,
      ]}>
      {({ pressed }) => <Icone size={16} color={pressed ? D.azul900 : D.slate400} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: D.fundo },

  cabecalho: {
    backgroundColor: D.branco,
    borderBottomWidth: 1,
    borderBottomColor: D.slate100,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 20,
    zIndex: 30,
    ...elevacaoSuave,
  },
  cabecalhoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: '800', color: D.slate900, letterSpacing: -0.5, flex: 1 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.esmeralda500 },
  liveTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: D.slate400,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: D.slate50,
    borderWidth: 1,
    borderColor: D.slate100,
    borderRadius: 16,
  },
  buscaInput: { flex: 1, fontSize: 14, color: D.slate900, fontWeight: '500', padding: 0 },

  principal: { flex: 1 },

  mapa: { width: '100%', height: 320, backgroundColor: D.slate100, position: 'relative' },
  mapaView: { flex: 1 },
  mapaVazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  mapaVazioTitulo: { fontSize: 14, fontWeight: '800', color: D.slate600 },
  mapaVazioTexto: { fontSize: 11, color: D.slate400, textAlign: 'center', maxWidth: 260 },

  pino: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: D.branco,
    borderWidth: 2,
    borderColor: D.azul900,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    ...elevacaoSuave,
  },
  pinoAvatar: { width: '100%', height: '100%', borderRadius: 12 },
  pinoStatus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: D.branco,
  },

  botaoMapa: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: D.branco,
    borderWidth: 1,
    borderColor: D.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevacaoSuave,
  },

  filtrosArea: { paddingHorizontal: 24, paddingVertical: 24 },
  filtros: { gap: 8, paddingRight: 24 },
  filtro: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, ...elevacaoSuave },
  filtroAtivo: { backgroundColor: D.azul900 },
  filtroInativo: { backgroundColor: D.branco, borderWidth: 1, borderColor: D.slate100 },
  filtroTexto: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  lista: { paddingHorizontal: 24, gap: 16 },
  aviso: { fontSize: 13, color: D.slate400, textAlign: 'center', paddingVertical: 32 },
  avisoErro: { fontSize: 13, color: '#dc2626', textAlign: 'center', paddingVertical: 32 },

  cartao: {
    backgroundColor: D.branco,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: D.slate50,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    ...elevacaoSuave,
  },
  cartaoEsmaecido: { opacity: 0.75 },
  avatarArea: {
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: D.slate50,
    borderWidth: 1,
    borderColor: D.slate100,
    padding: 2,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 12 },
  avatarStatus: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: D.branco,
  },
  cartaoTextos: { flex: 1, gap: 4 },
  nome: { fontSize: 14, fontWeight: '800', color: D.slate900, letterSpacing: -0.2 },
  subtitulo: { fontSize: 11, color: D.slate400, fontWeight: '500' },
  selo: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  seloTexto: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  acoes: { gap: 8 },
  acao: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: D.slate50,
    borderWidth: 1,
    borderColor: D.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acaoPressionada: { backgroundColor: D.azul50 },
  acaoInerte: { opacity: 0.45 },
  pressionado: { transform: [{ scale: 0.9 }] },
});
