import { ExternalLink, MapPinned } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { TechnicianCall } from '@/services/technician';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = { calls: TechnicianCall[]; selectedId: string | null; onSelect: (id: string) => void };

export function MapboxRouteMap({ calls, selectedId, onSelect }: Props) {
  const selected = calls.find((call) => call.id === selectedId) ?? calls[0];
  const openDirections = async () => {
    if (!selected?.address) return;
    const destination = encodeURIComponent([selected.address.street, selected.address.number, selected.address.city, 'Brasil'].filter(Boolean).join(', '));
    await Linking.openURL(`https://www.mapbox.com/directions/?destination=${destination}`);
  };

  return (
    <View style={styles.container}>
      <MapPinned size={36} color={colors.brand} />
      <Text variant="bodyStrong">Mapbox disponível no navegador</Text>
      <Text variant="meta" color={colors.textSecondary} style={styles.center}>No Expo Go, selecione um atendimento e abra a navegação pelo Mapbox.</Text>
      {selected ? <Pressable onPress={openDirections} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><ExternalLink size={16} color={colors.textOnBrand} /><Text variant="meta" color={colors.textOnBrand}>Abrir rota no Mapbox</Text></Pressable> : null}
      {calls.length > 1 ? <View style={styles.chips}>{calls.map((call) => <Pressable key={call.id} onPress={() => onSelect(call.id)} style={[styles.chip, call.id === selected?.id && styles.chipSelected]}><Text variant="meta" color={call.id === selected?.id ? colors.textOnBrand : colors.brandStrong}>#{call.code}</Text></Pressable>)}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 310, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.brandTint },
  center: { textAlign: 'center', maxWidth: 280 },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brand },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandSoft, backgroundColor: colors.bgSurface },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  pressed: { opacity: 0.8 },
});
