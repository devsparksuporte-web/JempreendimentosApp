import { Tabs } from 'expo-router';
import { AirVent, ClipboardList, LayoutDashboard, Sparkles, User } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, fonts, spacing } from '@/theme/tokens';

/** Tab bar do CLIENTE: Início | Equipamentos | Chamados | IA | Perfil */
export default function ClienteLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
