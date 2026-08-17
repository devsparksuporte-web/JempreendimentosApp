import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart3, Check, ChevronRight, UsersRound, Wind } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, fonts, layout, radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';

const SLIDES = [
  { icon: Wind, title: 'Gestão de Serviços', description: 'Acompanhe todos os seus serviços em tempo real com controle total na palma da mão.', color: colors.brand },
  { icon: UsersRound, title: 'Equipe Conectada', description: 'Comunique-se facilmente com sua equipe técnica e mantenha os clientes informados.', color: colors.warning },
  { icon: BarChart3, title: 'Relatórios Detalhados', description: 'Analise performance, custos e resultados de todos os seus atendimentos técnicos.', color: colors.success },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const Icon = slide.icon;

  async function finish() {
    await AsyncStorage.setItem('jempreendimentos.onboarding.completed', '1');
    router.replace('/(auth)/login');
  }

  return <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
    <View style={styles.progress}><Text variant="microLabel" color={colors.textSecondary}>{index + 1} de {SLIDES.length}</Text><View style={styles.progressTrack}><View style={[styles.progressValue, { width: `${((index + 1) / SLIDES.length) * 100}%` }]} /></View></View>
    <View style={styles.content}>
      <View style={styles.brandMark}><Text variant="screenTitle" color={colors.textOnBrand}>J</Text><View style={styles.brandCheck}><Check size={16} color={colors.textOnBrand} /></View></View>
      <View style={styles.iconCard}><Icon size={58} color={slide.color} strokeWidth={1.8} /><View style={[styles.cornerBadge, { backgroundColor: slide.color }]} /></View>
      <Text variant="screenTitle" style={styles.slideTitle}>{slide.title}</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.slideDescription}>{slide.description}</Text>
      <View style={styles.dots}>{SLIDES.map((_, dot) => <View key={dot} style={[styles.dot, dot === index && styles.dotActive]} />)}</View>
    </View>
    <View style={styles.actions}>
      <Button label={index === SLIDES.length - 1 ? 'COMEÇAR AGORA' : 'PRÓXIMO'} icon={index === SLIDES.length - 1 ? Check : ChevronRight} onPress={() => { if (index === SLIDES.length - 1) void finish(); else setIndex((current) => current + 1); }} />
      {index > 0 ? <Pressable onPress={() => setIndex((current) => current - 1)} style={styles.secondary}><Text variant="bodyStrong" color={colors.textSecondary}>Anterior</Text></Pressable> : <Pressable onPress={() => void finish()} style={styles.secondary}><Text variant="bodyStrong" color={colors.textSecondary}>Pular</Text></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: layout.screenPadding }, progress: { gap: spacing.sm, alignItems: 'flex-end' }, progressTrack: { width: 110, height: 5, borderRadius: radius.pill, backgroundColor: colors.slate200, overflow: 'hidden' }, progressValue: { height: '100%', backgroundColor: colors.brand, borderRadius: radius.pill }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }, slideTitle: { textAlign: 'center' }, slideDescription: { textAlign: 'center' }, brandMark: { width: 58, height: 58, borderRadius: radius.xl, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', position: 'relative' }, brandCheck: { position: 'absolute', right: -8, top: -8, width: 28, height: 28, borderRadius: radius.md, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }, iconCard: { width: 150, height: 150, borderRadius: radius.xl, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', ...({ shadowColor: '#001F3F', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 } as object), position: 'relative' }, cornerBadge: { position: 'absolute', right: -10, bottom: -10, width: 38, height: 38, borderRadius: radius.lg }, actions: { gap: spacing.sm }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: spacing.sm }, dots: { flexDirection: 'row', gap: spacing.sm }, dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.slate300 }, dotActive: { width: 24, backgroundColor: colors.brand }, });
