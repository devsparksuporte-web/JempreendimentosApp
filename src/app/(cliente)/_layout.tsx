import { Tabs } from 'expo-router';
import { AirVent, ClipboardList, LayoutDashboard, Sparkles, User } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BarraSuperior } from '@/components/BarraSuperior';
import { MenuLateral, useMenuLateral, type ItemDoMenu } from '@/components/MenuLateral';
import { colors, fonts, spacing } from '@/theme/tokens';

const ITENS_DO_MENU: ItemDoMenu[] = [
  { rota: '/(cliente)/inicio', rotulo: 'Início', icone: LayoutDashboard },
  { rota: '/(cliente)/equipamentos', rotulo: 'Equipamentos', icone: AirVent },
  { rota: '/(cliente)/chamados', rotulo: 'Chamados', icone: ClipboardList },
  { rota: '/(cliente)/ia', rotulo: 'Assistente', icone: Sparkles },
  { rota: '/(cliente)/perfil', rotulo: 'Perfil', icone: User },
];

/** Tab bar do CLIENTE: Início | Equipamentos | Chamados | IA | Perfil */
export default function ClienteLayout() {
  const noDesktop = useMenuLateral();

  const abas = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: noDesktop ? styles.semBarra : styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: { backgroundColor: colors.bgApp },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="equipamentos"
        options={{
          title: 'Equipamentos',
          tabBarIcon: ({ color }) => <AirVent size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="chamados"
        options={{
          title: 'Chamados',
          tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="ia"
        options={{
          title: 'IA',
          // Único uso de violeta na tab bar — marca o conteúdo de IA.
          tabBarIcon: ({ focused }) => (
            <Sparkles size={22} color={focused ? colors.ai : colors.textMuted} strokeWidth={2} />
          ),
          tabBarActiveTintColor: colors.ai,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2} />,
        }}
      />
      {/* Telas de detalhe: acessadas por navegacao, nunca como aba.
          Sem href:null o Expo Router cria uma aba para cada arquivo de
          rota do grupo, e elas aparecem sem icone nem rotulo. */}
      <Tabs.Screen name="inicio" options={{ href: null }} />
      <Tabs.Screen name="chamado/[id]" options={{ href: null }} />
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
  desktop: { flex: 1, flexDirection: 'row', backgroundColor: colors.bgApp },
  conteudo: { flex: 1 },
  tela: { flex: 1 },
  semBarra: { display: 'none' },
  tabBar: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 82,
    paddingTop: spacing.md,
    shadowColor: '#79a8be',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tabItem: { paddingVertical: spacing.xs },
  tabLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
});
