/**
 * Design tokens do JEmpreendimentos.
 *
 * Fonte da verdade: .superdesign/design-system.md
 * Nenhuma cor, fonte ou raio deve ser escrito solto nas telas — sempre daqui.
 */

export const colors = {
  // Base
  bgApp: '#F8FAFC',
  bgSurface: '#ffffff',
  border: '#E8E8E8',
  borderStrong: '#CBD5E1',

  textPrimary: '#001F3F',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textOnBrand: '#ffffff',

  // Marca técnica — azul-gelo inspirado em climatização
  brand: '#0047AB',
  brandStrong: '#001F3F',
  brandSoft: '#BFDBFE',
  brandTint: '#EFF6FF',

  // Semânticas
  success: '#059669',
  successSoft: '#d1fae5',
  successStrong: '#047857',

  warning: '#f97316',
  warningSoft: '#ffedd5',
  warningStrong: '#c2410c',

  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dangerStrong: '#b91c1c',

  info: '#2588c4',
  infoSoft: '#d9effa',
  infoStrong: '#12628e',

  /** Exclusivo de conteúdo gerado por IA. Nunca decorativo. */
  ai: '#7c3aed',
  aiSoft: '#f5f3ff',
  aiBorder: '#ddd6fe',
  aiStrong: '#5b21b6',

  // Neutros de apoio
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
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
    shadowColor: '#001F3F',
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
  maxContentWidth: 448,
  screenPadding: spacing.xl,
} as const;
