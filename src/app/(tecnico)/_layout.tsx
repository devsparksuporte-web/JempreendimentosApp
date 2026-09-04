import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ClipboardList, MapPinned, QrCode, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BarraSuperior } from '@/components/BarraSuperior';
import { MenuLateral, useMenuLateral, type ItemDoMenu } from '@/components/MenuLateral';
import { reportarMinhaLocalizacao } from '@/services/equipe';
import { colors, fonts, spacing } from '@/theme/tokens';

const ITENS_DO_MENU: ItemDoMenu[] = [
  { rota: '/(tecnico)/inicio', rotulo: 'Atendimentos', icone: ClipboardList },
  { rota: '/(tecnico)/rota', rotulo: 'Rota', icone: MapPinned },
  { rota: '/(tecnico)/qr', rotulo: 'Ler QR', icone: QrCode },
  { rota: '/(tecnico)/configuracoes', rotulo: 'Configurações', icone: Settings },
];

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
      <Tabs.Screen name="index" options={{ title: 'Atendimentos', tabBarIcon: ({ color }) => <ClipboardList size={21} color={color} /> }} />
      <Tabs.Screen name="rota" options={{ title: 'Rota', tabBarIcon: ({ color }) => <MapPinned size={21} color={color} /> }} />
      <Tabs.Screen name="qr" options={{ title: 'Ler QR', tabBarIcon: ({ color }) => <QrCode size={21} color={color} /> }} />
      <Tabs.Screen name="configuracoes" options={{ title: 'Configurações', tabBarIcon: ({ color }) => <Settings size={21} color={color} /> }} />
      {/* Telas de detalhe: acessadas por navegacao, nunca como aba.
          Sem href:null o Expo Router cria uma aba para cada arquivo de
          rota do grupo, e elas aparecem sem icone nem rotulo. */}
      <Tabs.Screen name="inicio" options={{ href: null }} />
      <Tabs.Screen name="chamado/[id]" options={{ href: null }} />
      <Tabs.Screen name="checklist/[id]" options={{ href: null }} />
      <Tabs.Screen name="fotos/[id]" options={{ href: null }} />
      <Tabs.Screen name="assinatura/[id]" options={{ href: null }} />
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
  tabLabel: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7, textTransform: 'uppercase' },
});
