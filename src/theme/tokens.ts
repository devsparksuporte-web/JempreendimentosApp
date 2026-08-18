/**
 * Design tokens do JEmpreendimentos.
 *
 * Fonte da verdade: .superdesign/design-system.md
 * Nenhuma cor, fonte ou raio deve ser escrito solto nas telas — sempre daqui.
 */

import { FORM_WIDTH, staticContentWidth } from '@/theme/responsive';

export const colors = {
  // Base
  // Identidade JEmpreendimentos: navy profundo, azul elétrico e branco-gelo.
  bgApp: '#F4F8FF',
  bgSurface: '#FFFFFF',
  border: '#D7E6F7',
  borderStrong: '#9FC2E8',

  textPrimary: '#06152E',
  textSecondary: '#48617D',
  textMuted: '#7891AB',
  textOnBrand: '#FFFFFF',

  // Marca técnica — azul elétrico com acentos ciano e climatização.
  brand: '#006BFF',
  brandStrong: '#062B68',
  brandSoft: '#8FD8FF',
  brandTint: '#E8F5FF',

  // Semânticas
  success: '#00A878',
  successSoft: '#D9F8ED',
  successStrong: '#007A5A',

  warning: '#FF7A00',
  warningSoft: '#FFF0D9',
  warningStrong: '#C65400',

  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dangerStrong: '#b91c1c',

  info: '#00BDEB',
  infoSoft: '#DDF8FF',
  infoStrong: '#00799B',

  /** Exclusivo de conteúdo gerado por IA. Nunca decorativo. */
  ai: '#7c3aed',
  aiSoft: '#f5f3ff',
  aiBorder: '#ddd6fe',
  aiStrong: '#5b21b6',

  // Neutros de apoio
  slate50: '#F4F8FF',
  slate100: '#EAF3FE',
  slate200: '#D7E6F7',
  slate300: '#B9CFE6',
} as const;

/** Escala de 4px. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  pill: 999,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Escala tipográfica. O micro-label uppercase com tracking largo é a
 * assinatura da interface — usar em rótulos de card e de seção.
 */
export const type = {
  kpi: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36 },
  screenTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  microLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  meta: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  tabLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;

/**
 * Elevação: a borda carrega a definição, a sombra é quase imperceptível.
 * Nunca sombra pesada ou colorida.
 */
export const elevation = {
  card: {
    shadowColor: '#062B68',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
} as const;

/** Alvo de toque mínimo — técnico usa em campo, com luva, uma mão. */
export const touch = {
  minTarget: 48,
  primaryButton: 56,
  fieldAction: 64,
} as const;

/** Container mobile centralizado (não estica em tablet). */
export const layout = {
  /**
   * Largura máxima do conteúdo, já adaptada ao tamanho da tela:
   * 448 no celular, 880 no tablet, 1040 no tablet grande.
   * Ver `src/theme/responsive.ts`. Para reagir a rotação/split-screen,
   * use o hook `useResponsive()` em vez deste valor.
   */
  maxContentWidth: staticContentWidth,
  /** Telas de formulário — ver FORM_WIDTH em responsive.ts. */
  maxFormWidth: FORM_WIDTH,
  screenPadding: spacing.xl,
} as const;
