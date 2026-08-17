import { supabase } from '@/lib/supabase';
import type {
  Client,
  Equipment,
  MaintenanceSchedule,
  ServiceCall,
  ServiceCallStatusHistory,
  ServiceStatus,
  Technician,
} from '@/types/database';

/** Chamado com os relacionamentos que as telas do cliente exibem. */
export type ServiceCallDetailed = ServiceCall & {
  equipment: Pick<
    Equipment,
    'id' | 'brand' | 'model' | 'btu_capacity' | 'environment' | 'kind'
  > | null;
  technician: (Pick<Technician, 'id' | 'status'> & { profile: { full_name: string } | null }) | null;
  address: { street: string; number: string | null; complement: string | null } | null;
};

export type ClienteHome = {
  client: Client | null;
  equipment: Equipment[];
  activeCall: ServiceCallDetailed | null;
  nextMaintenance: (MaintenanceSchedule & { equipment: Pick<Equipment, 'brand' | 'environment'> | null }) | null;
};

/** Status considerados "em aberto" — alimentam o card de atendimento na Home. */
const ACTIVE_STATUSES: ServiceStatus[] = [
  'aberto',
  'em_analise',
  'aguardando_tecnico',
  'tecnico_atribuido',
  'a_caminho',
  'em_atendimento',
  'aguardando_peca',
  'aguardando_aprovacao',
];

const CALL_SELECT = `
  *,
  equipment:equipment_id ( id, brand, model, btu_capacity, environment, kind ),
  technician:technician_id ( id, status, profile:profile_id ( full_name ) ),
  address:address_id ( street, number, complement )
`;

/**
 * Carrega tudo que a Home do Cliente precisa.
 * Mesmo com RLS, o filtro explícito por profile_id evita que perfis
 * administrativos recebam múltiplos clientes no carregamento da Home.
 */
export async function fetchClienteHome(): Promise<ClienteHome> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!user) throw new Error('Sessão expirada. Entre novamente para continuar.');

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('profile_id', user.id)
    .limit(1)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);
  if (!client) return { client: null, equipment: [], activeCall: null, nextMaintenance: null };

  const [equipmentRes, callRes, maintenanceRes] = await Promise.all([
    supabase
      .from('equipment')
      .select('*')
      .eq('client_id', client.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),

    supabase
      .from('service_calls')
      .select(CALL_SELECT)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('maintenance_schedules')
      .select('*, equipment:equipment_id ( brand, environment )')
      .eq('active', true)
      .order('next_due_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (equipmentRes.error) throw new Error(equipmentRes.error.message);

  return {
    client,
    equipment: equipmentRes.data ?? [],
    activeCall: (callRes.data as ServiceCallDetailed | null) ?? null,
    nextMaintenance: (maintenanceRes.data as ClienteHome['nextMaintenance']) ?? null,
  };
}

export async function fetchServiceCall(id: string): Promise<ServiceCallDetailed> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(CALL_SELECT)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as ServiceCallDetailed;
}

export async function fetchStatusHistory(callId: string): Promise<ServiceCallStatusHistory[]> {
  const { data, error } = await supabase
    .from('service_call_status_history')
    .select('*')
    .eq('service_call_id', callId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchMyServiceCalls(): Promise<ServiceCallDetailed[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(CALL_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceCallDetailed[];
}

/** Cria o chamado a partir do resumo estruturado montado pela IA na triagem. */
export async function createServiceCallFromTriage(input: {
  clientId: string;
  equipmentId: string | null;
  addressId: string | null;
  title: string;
  description: string;
  aiSummary: Record<string, string>;
}): Promise<ServiceCall> {
  const { data, error } = await supabase
    .from('service_calls')
    .insert({
      client_id: input.clientId,
      equipment_id: input.equipmentId,
      address_id: input.addressId,
      title: input.title,
      description: input.description,
      ai_summary: input.aiSummary,
      service_type: 'manutencao_corretiva',
      priority: 'normal',
      status: 'aberto',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ServiceCall;
}


export async function cancelMyServiceCall(callId: string, reason?: string) {
  const { error } = await (supabase as any).rpc('client_cancel_service_call', { p_call_id: callId, p_reason: reason ?? null });
  if (error) throw new Error(error.message);
}

export async function adminUpdateServiceCall(input: {
  callId: string;
  title?: string;
  description?: string | null;
  priority?: ServiceCall['priority'];
  diagnosis?: string | null;
  solution?: string | null;
  scheduledFor?: string | null;
  technicianId?: string | null;
  setTechnician?: boolean;
  status?: ServiceCall['status'];
}) {
  const { error } = await (supabase as any).rpc('admin_update_service_call', {
    p_call_id: input.callId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_priority: input.priority ?? null,
    p_diagnosis: input.diagnosis ?? null,
    p_solution: input.solution ?? null,
    p_scheduled_for: input.scheduledFor ?? null,
    p_technician_id: input.technicianId ?? null,
    p_set_technician: input.setTechnician ?? false,
    p_status: input.status ?? null,
  });
  if (error) throw new Error(error.message);
}
