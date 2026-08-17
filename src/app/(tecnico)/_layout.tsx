import { Tabs } from 'expo-router';
import { ClipboardList, MapPinned, QrCode, Settings } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, fonts, spacing } from '@/theme/tokens';

export default function TechnicianLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Atendimentos', tabBarIcon: ({ color }) => <ClipboardList size={21} color={color} /> }} />
      <Tabs.Screen name="rota" options={{ title: 'Rota', tabBarIcon: ({ color }) => <MapPinned size={21} color={color} /> }} />
      <Tabs.Screen name="qr" options={{ title: 'Ler QR', tabBarIcon: ({ color }) => <QrCode size={21} color={color} /> }} />
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
