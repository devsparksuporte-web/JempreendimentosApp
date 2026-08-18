import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useResponsive } from '@/theme/responsive';
import { spacing } from '@/theme/tokens';

type CardGridProps = {
  children: ReactNode;
  /** Espaço entre os cards. */
  gap?: number;
  /**
   * Faz o primeiro filho ocupar a linha inteira mesmo em tablet — para o card
   * de destaque da tela (ex.: atendimento em andamento).
   */
  fullWidthFirst?: boolean;
};

/**
 * Distribui cards em colunas conforme a largura da tela.
 *
 * No celular é uma coluna só, idêntico ao empilhamento anterior. No tablet
 * vira duas colunas — que é onde a largura extra rende de verdade: em vez de
 * uma pilha longa, o dobro de chamados visíveis sem rolar.
 *
 * O espaçamento sai de padding nas células com margem negativa no contêiner,
 * e não de `gap`: com `gap` + largura de 50%, duas células somariam mais de
 * 100% e quebrariam para linhas separadas.
 */
export function CardGrid({ children, gap = spacing.md, fullWidthFirst = false }: CardGridProps) {
  const { columns } = useResponsive();
  const items = Children.toArray(children).filter(Boolean);

  if (columns === 1) {
    return <View style={{ gap }}>{items}</View>;
  }

  const destaque = fullWidthFirst ? items[0] : null;
  const restantes = fullWidthFirst ? items.slice(1) : items;
  const larguraCelula = `${100 / columns}%` as const;

  return (
    <View style={{ gap }}>
      {destaque}
      <View style={[styles.grid, { marginHorizontal: -gap / 2 }]}>
        {restantes.map((item, index) => (
          <View
            key={index}
            style={{ width: larguraCelula, paddingHorizontal: gap / 2, paddingBottom: gap }}>
            {item}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
