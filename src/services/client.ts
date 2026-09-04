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
  /**
   * Avaliação do cliente. O PostgREST devolve array ou objeto conforme detecte
   * a unicidade da FK, então os dois formatos são aceitos aqui.
   */
  rating: { rating: number } | { rating: number }[] | null;
};

export type ClienteHome = {
  client: Client | null;
  equipment: Equipment[];
  /** Primeiro dos abertos. Mantido porque telas antigas já leem daqui. */
  activeCall: ServiceCallDetailed | null;
  /** Todos os chamados em aberto, para contar e listar no painel. */
  abertos: ServiceCallDetailed[];
  /** Últimos chamados, de qualquer status — o histórico curto do painel. */
  recentes: ServiceCallDetailed[];
  nextMaintenance: (MaintenanceSchedule & { equipment: Pick<Equipment, 'brand' | 'environment'> | null }) | null;
};

/** Em campo agora: o técnico saiu ou já está no local. */
const STATUS_EM_ANDAMENTO: ServiceStatus[] = ['a_caminho', 'em_atendimento'];

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
  address:address_id ( street, number, complement ),
  rating:service_ratings ( rating )
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
  if (!client) {
    return {
      client: null,
      equipment: [],
      activeCall: null,
      abertos: [],
      recentes: [],
      nextMaintenance: null,
    };
  }

  const [equipmentRes, abertosRes, recentesRes, maintenanceRes] = await Promise.all([
    supabase
      .from('equipment')
      .select('*')
      .eq('client_id', client.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),

    // Todos os abertos, não só o primeiro: o painel conta e lista.
    supabase
      .from('service_calls')
      .select(CALL_SELECT)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('service_calls')
      .select(CALL_SELECT)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('maintenance_schedules')
      .select('*, equipment:equipment_id ( brand, environment )')
      .eq('active', true)
      .order('next_due_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (equipmentRes.error) throw new Error(equipmentRes.error.message);

  const abertos = (abertosRes.data as ServiceCallDetailed[] | null) ?? [];

  return {
    client,
    equipment: equipmentRes.data ?? [],
    activeCall: abertos[0] ?? null,
    abertos,
    recentes: (recentesRes.data as ServiceCallDetailed[] | null) ?? [],
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

/** Normaliza a avaliação, que vem como objeto ou lista dependendo do embed. */
export function notaDoChamado(call: ServiceCallDetailed): number | null {
  const r = call.rating;
  if (!r) return null;
  const item = Array.isArray(r) ? r[0] : r;
  return item?.rating ?? null;
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


/** Números do painel do cliente, calculados uma vez sobre o que já veio. */
export function resumoDoCliente(home: ClienteHome) {
  const emAndamento = home.abertos.filter((c) => STATUS_EM_ANDAMENTO.includes(c.status)).length;

  // A próxima visita é a data mais próxima entre os chamados agendados e a
  // preventiva programada — o cliente não distingue as duas origens, ele só
  // quer saber quando alguém aparece.
  const datas = [
    ...home.abertos.map((c) => c.scheduled_for).filter(Boolean),
    home.nextMaintenance?.next_due_at,
  ].filter(Boolean) as string[];

  const proxima = datas.sort()[0] ?? null;

  return {
    equipamentos: home.equipment.length,
    abertos: home.abertos.length,
    emAndamento,
    proximaVisita: proxima,
  };
}
