import { Tabs } from 'expo-router';
import { BrainCircuit, ClipboardList, FileCheck2, PackageSearch, Settings } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, fonts, spacing } from '@/theme/tokens';

export default function AdminLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Painel', tabBarIcon: ({ color }) => <ClipboardList size={21} color={color} /> }} />
      <Tabs.Screen name="pmoc" options={{ title: 'PMOC', tabBarIcon: ({ color }) => <FileCheck2 size={21} color={color} /> }} />
      <Tabs.Screen name="estoque" options={{ title: 'Estoque', tabBarIcon: ({ color }) => <PackageSearch size={21} color={color} /> }} />
      <Tabs.Screen name="distribuicao" options={{ title: 'Distribuição', tabBarIcon: ({ color }) => <BrainCircuit size={21} color={color} /> }} />
      <Tabs.Screen name="configuracoes" options={{ title: 'Configurações', tabBarIcon: ({ color }) => <Settings size={21} color={color} /> }} />
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
  tabLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7, textTransform: 'uppercase' },
});
