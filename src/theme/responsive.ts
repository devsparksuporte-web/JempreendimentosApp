import { Dimensions, useWindowDimensions } from 'react-native';

/**
 * Layout responsivo.
 *
 * O app nasceu mobile-first com uma coluna fixa de 448px centralizada. Isso
 * funciona no celular, mas num tablet de 1200px vira uma faixa estreita no
 * meio com quase 400px vazios de cada lado. Aqui a largura acompanha a tela.
 *
 * A coluna cresce, mas não sem limite: linha de texto muito larga cansa a
 * leitura. Acima do tablet o ganho vai para o grid, não para a largura da
 * linha.
 */

export const breakpoints = {
  /** Celular. */
  phone: 0,
  /** Tablet pequeno / celular na horizontal. */
  tablet: 768,
  /** Tablet grande. */
  wide: 1024,
} as const;

export function contentWidthFor(screenWidth: number): number {
  if (screenWidth >= breakpoints.wide) return 1040;
  if (screenWidth >= breakpoints.tablet) return 880;
  return 448;
}

/** Quantas colunas de card cabem confortavelmente. */
export function columnsFor(screenWidth: number): number {
  if (screenWidth >= breakpoints.wide) return 2;
  if (screenWidth >= breakpoints.tablet) return 2;
  return 1;
}

/**
 * Formulários não ganham nada com largura — um campo de e-mail de 1000px só
 * obriga o olho a percorrer o vazio. Telas de entrada de dados (login,
 * recuperação de senha) param aqui, mesmo em tela grande.
 */
export const FORM_WIDTH = 560;

export function formWidthFor(screenWidth: number): number {
  return Math.min(screenWidth, FORM_WIDTH);
}

/**
 * Largura calculada uma vez, na carga do módulo.
 *
 * Serve para os `StyleSheet.create` — que são estáticos e não conseguem ler
 * um hook. É seguro porque o app está travado em retrato (`orientation:
 * "portrait"` no app.json), então a largura da janela não muda em uso.
 * Telas que precisam reagir a mudanças usam `useResponsive()`.
 */
export const staticContentWidth = contentWidthFor(Dimensions.get('window').width);

export type Responsive = {
  width: number;
  isTablet: boolean;
  /** Largura máxima do container de conteúdo. */
  contentWidth: number;
  /** Colunas do grid de cards. */
  columns: number;
};

/** Versão reativa — reflete rotação, split-screen e janela redimensionada. */
export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  return {
    width,
    isTablet: width >= breakpoints.tablet,
    contentWidth: contentWidthFor(width),
    columns: columnsFor(width),
  };
}
