/**
 * Paleta do design "Mapa de Técnicos".
 *
 * Estes valores vêm do HTML entregue pelo cliente (escala slate + blue-900 do
 * Tailwind) e não dos tokens do app, por pedido explícito de manter a tela
 * igual ao enviado. Ficam aqui para a tela e a barra de navegação usarem a
 * mesma fonte, em vez de repetir hex em dois arquivos.
 */
export const D = {
  fundo: '#f1f5f9',
  branco: '#ffffff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate600: '#475569',
  slate900: '#0f172a',
  azul900: '#1e3a8a',
  azul50: '#eff6ff',
  esmeralda50: '#ecfdf5',
  esmeralda100: '#d1fae5',
  esmeralda500: '#10b981',
  esmeralda600: '#059669',
  ambar50: '#fffbeb',
  ambar100: '#fef3c7',
  ambar500: '#f59e0b',
  ambar600: '#d97706',
} as const;

/** Sombra `soft-elevation`: 0 10px 40px -10px rgba(15, 23, 42, 0.05). */
export const elevacaoSuave = {
  shadowColor: D.slate900,
  shadowOpacity: 0.05,
  shadowRadius: 40,
  shadowOffset: { width: 0, height: 10 },
  elevation: 3,
} as const;
