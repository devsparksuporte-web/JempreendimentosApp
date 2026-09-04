import { Tabs } from 'expo-router';
import {
  BrainCircuit,
  FileCheck2,
  LayoutGrid,
  MapPin,
  PackageSearch,
  ShieldCheck,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraSuperior } from '@/components/BarraSuperior';
import { MenuLateral, useMenuLateral, type ItemDoMenu } from '@/components/MenuLateral';
import { D, elevacaoSuave } from '@/theme/paletaMapa';

/**
 * Barra de navegação no visual do design "Mapa de Técnicos": fundo branco,
 * borda slate-100, item ativo com a pílula azul-50 arredondada e rótulo de
 * 10px em caixa alta.
 */
function Icone({ Glifo, ativo }: { Glifo: typeof LayoutGrid; ativo: boolean }) {
  return (
    <View style={[styles.icone, ativo && styles.iconeAtivo]}>
      <Glifo size={24} color={ativo ? D.azul900 : D.slate300} />
    </View>
  );
}

const ITENS_DO_MENU: ItemDoMenu[] = [
  { rota: '/(admin)/inicio', rotulo: 'Início', icone: LayoutGrid },
  { rota: '/(admin)/tecnicos', rotulo: 'Mapa da equipe', icone: MapPin },
  { rota: '/(admin)/pmoc', rotulo: 'PMOC', icone: FileCheck2 },
  { rota: '/(admin)/estoque', rotulo: 'Estoque', icone: PackageSearch },
  { rota: '/(admin)/distribuicao', rotulo: 'Distribuição', icone: BrainCircuit },
  { rota: '/(admin)/configuracoes', rotulo: 'Perfil', icone: ShieldCheck },
];

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const noDesktop = useMenuLateral();

  const abas = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: D.azul900,
        tabBarInactiveTintColor: D.slate300,
        tabBarStyle: noDesktop
          ? styles.semBarra
          : [styles.tabBar, { height: 78 + insets.bottom, paddingBottom: insets.bottom + 8 }],
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: { backgroundColor: D.fundo },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ focused }) => <Icone Glifo={LayoutGrid} ativo={focused} /> }}
      />
      <Tabs.Screen
        name="tecnicos"
        options={{ title: 'Mapa', tabBarIcon: ({ focused }) => <Icone Glifo={MapPin} ativo={focused} /> }}
      />
      <Tabs.Screen
        name="pmoc"
        options={{ title: 'PMOC', tabBarIcon: ({ focused }) => <Icone Glifo={FileCheck2} ativo={focused} /> }}
      />
      <Tabs.Screen
        name="estoque"
        options={{ title: 'Estoque', tabBarIcon: ({ focused }) => <Icone Glifo={PackageSearch} ativo={focused} /> }}
      />
      <Tabs.Screen
        name="distribuicao"
        options={{ title: 'Distribuição', tabBarIcon: ({ focused }) => <Icone Glifo={BrainCircuit} ativo={focused} /> }}
      />
      <Tabs.Screen
        name="configuracoes"
        options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <Icone Glifo={ShieldCheck} ativo={focused} /> }}
      />
      {/* Telas de detalhe: acessadas por navegacao, nunca como aba.
          Sem href:null o Expo Router cria uma aba para cada arquivo de
          rota do grupo, e elas aparecem sem icone nem rotulo. */}
      <Tabs.Screen name="inicio" options={{ href: null }} />
      <Tabs.Screen name="chamado/[id]" options={{ href: null }} />
      <Tabs.Screen name="pmoc/[id]" options={{ href: null }} />
      <Tabs.Screen name="relatorios" options={{ href: null }} />
      <Tabs.Screen name="whatsapp" options={{ href: null }} />
      <Tabs.Screen name="painel" options={{ href: null }} />
      <Tabs.Screen name="produto/[id]" options={{ href: null }} />
      <Tabs.Screen name="reposicao" options={{ href: null }} />
      <Tabs.Screen name="reposicao/[id]" options={{ href: null }} />
      <Tabs.Screen name="recebimento" options={{ href: null }} />
      <Tabs.Screen name="recebimento/[id]" options={{ href: null }} />
      <Tabs.Screen name="chamados" options={{ href: null }} />
      <Tabs.Screen name="equipe" options={{ href: null }} />
      <Tabs.Screen name="tecnico/[id]" options={{ href: null }} />
      <Tabs.Screen name="fornecedores" options={{ href: null }} />
      <Tabs.Screen name="fornecedor/[id]" options={{ href: null }} />
      <Tabs.Screen name="clientes" options={{ href: null }} />
      <Tabs.Screen name="cliente/[id]" options={{ href: null }} />
      <Tabs.Screen name="equipamento/[id]" options={{ href: null }} />
    </Tabs>
  );

  if (!noDesktop) return abas;

  return (
    <View style={styles.desktop}>
      <MenuLateral itens={ITENS_DO_MENU} />
      <View style={styles.conteudo}>
        <BarraSuperior />
        <View style={styles.tela}>{abas}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktop: { flex: 1, flexDirection: 'row', backgroundColor: D.fundo },
  conteudo: { flex: 1 },
  tela: { flex: 1 },
  semBarra: { display: 'none' },
  tabBar: {
    backgroundColor: D.branco,
    borderTopWidth: 1,
    borderTopColor: D.slate100,
    paddingTop: 16,
    ...elevacaoSuave,
  },
  tabItem: { gap: 6 },
  tabLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: -0.25 },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconeAtivo: { backgroundColor: D.azul50 },
});
