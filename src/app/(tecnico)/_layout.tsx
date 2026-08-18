import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ClipboardList, MapPinned, QrCode, Settings } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { reportarMinhaLocalizacao } from '@/services/equipe';
import { colors, fonts, spacing } from '@/theme/tokens';

/** De quanto em quanto tempo a posição do técnico é enviada. */
const INTERVALO_LOCALIZACAO_MS = 2 * 60 * 1000;

export default function TechnicianLayout() {
  // Enquanto o técnico estiver no app, a operação vê onde ele está. Falha em
  // silêncio: sem permissão ou sem sinal, o trabalho em campo segue igual.
  useEffect(() => {
    void reportarMinhaLocalizacao();
    const timer = setInterval(() => {
      void reportarMinhaLocalizacao();
    }, INTERVALO_LOCALIZACAO_MS);
    return () => clearInterval(timer);
  }, []);

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
      {/* Telas de detalhe: acessadas por navegacao, nunca como aba.
          Sem href:null o Expo Router cria uma aba para cada arquivo de
          rota do grupo, e elas aparecem sem icone nem rotulo. */}
      <Tabs.Screen name="chamado/[id]" options={{ href: null }} />
      <Tabs.Screen name="checklist/[id]" options={{ href: null }} />
      <Tabs.Screen name="fotos/[id]" options={{ href: null }} />
      <Tabs.Screen name="assinatura/[id]" options={{ href: null }} />
      <Tabs.Screen name="equipamento/[id]" options={{ href: null }} />
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
