import { supabase } from '@/lib/supabase';
import type { ServiceCall, ServicePriority, ServiceType, TechnicianStatus } from '@/types/database';

export type DistributionSettings = {
  id: string;
  default_duration_minutes: number;
  default_sla_minutes: number;
  weight_availability: number;
  weight_specialty: number;
  weight_workload: number;
  weight_duration: number;
  weight_location: number;
  weight_round_robin: number;
  max_concurrent_calls: number;
  allow_without_specialty: boolean;
  allow_after_hours: boolean;
  timezone: string;
  work_days: number[];
  work_start: string;
  work_end: string;
  escalation_after_minutes: number;
};

export type DistributionRun = {
  id: string;
  service_call_id: string;
  selected_technician_id: string | null;
  estimated_duration_minutes: number;
  candidate_scores: Array<{ technician_name?: string; score?: number; active_calls?: number; estimated_minutes?: number }>;
  explanation: string;
  created_at: string;
  service_call?: Pick<ServiceCall, 'code' | 'title' | 'priority' | 'service_type'> | null;
  technician?: { profile: { full_name: string } | null } | null;
};

export type DistributionTechnician = {
  technician_id: string;
  status: TechnicianStatus;
  specialties: string[];
  active: boolean;
  profile: { full_name: string } | null;
  max_concurrent_calls: number;
  service_area: string | null;
  blocked_until: string | null;
  absence_reason: string | null;
};

export async function fetchDistributionSettings(): Promise<DistributionSettings> {
  const { data, error } = await (supabase as any).from('service_distribution_settings').select('*').eq('singleton', true).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Configuração de distribuição não encontrada.');
  return data as DistributionSettings;
}

export async function updateDistributionSettings(id: string, patch: Partial<DistributionSettings>) {
  const { error } = await (supabase as any).from('service_distribution_settings').update(patch).eq('id', id).limit(1);
  if (error) throw new Error(error.message);
}

export async function fetchDistributionTechnicians(): Promise<DistributionTechnician[]> {
  const { data, error } = await (supabase as any)
    .from('technicians')
    .select('id, status, specialties, active, profile:profile_id ( full_name ), distribution:technician_distribution_profiles ( max_concurrent_calls, service_area, blocked_until, absence_reason )')
    .eq('active', true)
    .order('status', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((item) => {
    const distribution = Array.isArray(item.distribution) ? item.distribution[0] : item.distribution;
    return { technician_id: item.id as string, status: item.status as TechnicianStatus, specialties: (item.specialties as string[]) ?? [], active: Boolean(item.active), profile: item.profile as DistributionTechnician['profile'], ...(distribution as object ?? {}), max_concurrent_calls: Number((distribution as { max_concurrent_calls?: number } | null)?.max_concurrent_calls ?? 3) } as DistributionTechnician;
  });
}

export async function fetchDistributionRuns(): Promise<DistributionRun[]> {
  const { data, error } = await (supabase as any)
    .from('service_distribution_runs')
    .select('id, service_call_id, selected_technician_id, estimated_duration_minutes, candidate_scores, explanation, created_at, service_call:service_call_id ( code, title, priority, service_type ), technician:selected_technician_id ( profile:profile_id ( full_name ) )')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as DistributionRun[];
}

export async function distributeServiceCall(serviceCallId: string) {
  const { data, error } = await (supabase as any).rpc('admin_distribute_service_call', { p_service_call_id: serviceCallId });
  if (error) throw new Error(error.message);
  return data as string | null;
}

export const SERVICE_TYPES: Array<{ value: ServiceType; label: string }> = [
  { value: 'instalacao', label: 'Instalação' },
  { value: 'manutencao_preventiva', label: 'Manutenção preventiva' },
  { value: 'manutencao_corretiva', label: 'Manutenção corretiva' },
  { value: 'higienizacao', label: 'Higienização' },
  { value: 'pmoc', label: 'PMOC' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'visita_tecnica', label: 'Visita técnica' },
];

export const PRIORITIES: Array<{ value: ServicePriority; label: string }> = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export type UnassignedServiceCall = Pick<ServiceCall, 'id' | 'code' | 'title' | 'priority' | 'service_type' | 'status'>;

export async function fetchUnassignedServiceCalls(): Promise<UnassignedServiceCall[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select('id, code, title, priority, service_type, status')
    .is('technician_id', null)
    .in('status', ['aberto', 'em_analise', 'aguardando_tecnico'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as UnassignedServiceCall[];
}
