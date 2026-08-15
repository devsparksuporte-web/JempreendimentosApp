import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

type IconTileProps = {
  icon: LucideIcon;
  /** `lg` = card KPI (56px). `md` = linha de lista (40px). */
  size?: 'lg' | 'md';
  color?: string;
  background?: string;
};

export function IconTile({
  icon: Icon,
  size = 'lg',
  color = colors.brand,
  background = colors.brandTint,
}: IconTileProps) {
  const box = size === 'lg' ? 56 : 40;
  const glyph = size === 'lg' ? 28 : 20;

  return (
    <View
      style={[
        styles.tile,
        {
          width: box,
          height: box,
          borderRadius: size === 'lg' ? radius.lg : radius.md,
          backgroundColor: background,
        },
      ]}>
      <Icon size={glyph} color={color} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
