import type { ServicePriority, ServiceStatus } from '@/types/database';

import type { BadgeTone } from '@/components/ui/Badge';

/** Vocabulário fixo de status da UI (design system, seção 10). */
export const STATUS_LABEL: Record<ServiceStatus, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  aguardando_tecnico: 'Aguardando técnico',
  tecnico_atribuido: 'Técnico atribuído',
  a_caminho: 'A caminho',
  em_atendimento: 'Em atendimento',
  aguardando_peca: 'Aguardando peça',
  aguardando_aprovacao: 'Aguardando aprovação',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const STATUS_TONE: Record<ServiceStatus, BadgeTone> = {
  aberto: 'neutral',
  em_analise: 'info',
  aguardando_tecnico: 'warning',
  tecnico_atribuido: 'info',
  a_caminho: 'info',
  em_atendimento: 'info',
  aguardando_peca: 'warning',
  aguardando_aprovacao: 'warning',
  finalizado: 'success',
  cancelado: 'neutral',
};

/** Status ao vivo — ganham o ponto pulsante no badge. */
export const STATUS_LIVE: ServiceStatus[] = ['a_caminho', 'em_atendimento'];

export const PRIORITY_LABEL: Record<ServicePriority, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const PRIORITY_TONE: Record<ServicePriority, BadgeTone> = {
  baixa: 'neutral',
  normal: 'info',
  alta: 'warning',
  urgente: 'danger',
};

/** "LG 12.000 BTUs" */
export function equipmentName(e: {
  brand?: string | null;
  btu_capacity?: number | null;
}): string {
  const brand = e.brand ?? 'Equipamento';
  if (!e.btu_capacity) return brand;
  return `${brand} ${e.btu_capacity.toLocaleString('pt-BR')} BTUs`;
}

/** 25/08/2026 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 13:48 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "faltam 10 dias" / "hoje" / "atrasada há 3 dias" */
export function daysUntilLabel(dateValue: string | null | undefined): string {
  if (!dateValue) return '';
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);

  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'amanhã';
  if (diffDays > 1) return `faltam ${diffDays} dias`;
  if (diffDays === -1) return 'atrasada há 1 dia';
  return `atrasada há ${Math.abs(diffDays)} dias`;
}

/** Primeiro nome, para a saudação. */
export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
