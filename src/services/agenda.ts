import { supabase } from '@/lib/supabase';
import type { ServiceCall } from '@/types/database';

export type AgendaEntry = Pick<ServiceCall, 'id' | 'code' | 'title' | 'status' | 'priority' | 'service_type' | 'scheduled_for' | 'client_id' | 'technician_id' | 'description'> & {
  scheduled_end: string | null;
  client: { name: string } | null;
  equipment: { brand: string | null; model: string | null; environment: string | null } | null;
  technician: { profile: { full_name: string | null } | null } | null;
  address: { street: string | null; number: string | null; district: string | null; city: string | null } | null;
};

const CAMPOS_AGENDA =
  'id, code, title, description, status, priority, service_type, scheduled_for, scheduled_end, client_id, technician_id, ' +
  'client:client_id ( name ), equipment:equipment_id ( brand, model, environment ), ' +
  'technician:technician_id ( profile:profile_id ( full_name ) ), ' +
  'address:address_id ( street, number, district, city )';

export async function fetchAgendaEntries(from: string, to: string): Promise<AgendaEntry[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(CAMPOS_AGENDA)
    .not('scheduled_for', 'is', null)
    .gte('scheduled_for', from)
    .lt('scheduled_for', to)
    .order('scheduled_for', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AgendaEntry[];
}

/**
 * Agendamentos do próprio cliente, do mais próximo para o mais distante.
 *
 * Não há filtro por cliente aqui: a RLS já limita cada um ao que é seu.
 * Repetir a regra no aplicativo criaria um segundo lugar para ela divergir.
 */
export async function fetchMeusAgendamentos(): Promise<AgendaEntry[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(CAMPOS_AGENDA)
    .not('scheduled_for', 'is', null)
    .not('status', 'in', '("cancelado","finalizado")')
    .order('scheduled_for', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AgendaEntry[];
}

// ---------------------------------------------------------------------------
// Reserva de horário
//
// Toda a regra de conflito mora no banco (migração 0034): uma EXCLUDE
// constraint sobre o intervalo do técnico. Estas funções só levam e trazem —
// não repetem a validação, porque validação repetida no cliente é a que
// diverge primeiro e a que não segura duas pessoas agendando ao mesmo tempo.
// ---------------------------------------------------------------------------

/** Faixa de horário na grade do dia de um técnico. */
export type FaixaDeHorario = {
  inicio: string;
  fim: string;
  ocupado: boolean;
  /** Só vem preenchido para a administração e para o próprio técnico. */
  service_call_id: string | null;
  code: number | null;
  cliente: string | null;
};

/**
 * `YYYY-MM-DD` a partir das partes locais da data.
 *
 * `toISOString()` converte para UTC e, em Brasília, joga a madrugada para o
 * dia anterior — o mesmo erro que já apareceu nos documentos do PMOC.
 */
export function diaISO(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export async function horariosDoTecnico(
  technicianId: string,
  dia: Date,
  slotMinutos = 60,
): Promise<FaixaDeHorario[]> {
  const { data, error } = await (supabase as any).rpc('horarios_do_tecnico', {
    p_technician_id: technicianId,
    p_dia: diaISO(dia),
    p_slot_minutos: slotMinutos,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as FaixaDeHorario[];
}

/**
 * Marca ou remarca o atendimento.
 *
 * O banco devolve a mensagem pronta quando o horário está ocupado — inclusive
 * distinguindo "agendar" de "reagendar" —, então ela sobe como está.
 */
export async function agendarAtendimento(input: {
  callId: string;
  inicio: Date;
  duracaoMinutos?: number;
  technicianId?: string;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('agendar_atendimento', {
    p_call_id: input.callId,
    p_inicio: input.inicio.toISOString(),
    p_duracao_minutos: input.duracaoMinutos ?? null,
    p_technician_id: input.technicianId ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Libera o horário sem cancelar o chamado. */
export async function cancelarAgendamento(callId: string, motivo?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('cancelar_agendamento', {
    p_call_id: callId,
    p_motivo: motivo ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Rótulo de um intervalo: "14:00 - 15:00". */
export function faixaBonita(inicio: string | null, fim: string | null): string {
  if (!inicio) return 'Sem horário';
  const hora = (v: string) =>
    new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(v));
  return fim ? `${hora(inicio)} - ${hora(fim)}` : hora(inicio);
}
