import { supabase } from '@/lib/supabase';
import type { ServiceCall, ServiceStatus, Technician, TechnicianStatus } from '@/types/database';

type AdminCall = ServiceCall & {
  client: { name: string } | null;
  equipment: { brand: string | null; model: string | null; environment: string | null } | null;
  technician: { profile: { full_name: string } | null } | null;
};

type AdminTechnician = Pick<Technician, 'id' | 'status' | 'active'> & {
  profile: { full_name: string } | null;
};

export type AdminDashboard = {
  calls: AdminCall[];
  technicians: AdminTechnician[];
  maintenanceDue: number;
  totals: {
    open: number;
    urgent: number;
    techniciansAvailable: number;
  };
};

const OPEN_STATUSES: ServiceStatus[] = [
  'aberto',
  'em_analise',
  'aguardando_tecnico',
  'tecnico_atribuido',
  'a_caminho',
  'em_atendimento',
  'aguardando_peca',
  'aguardando_aprovacao',
];

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [callsRes, techniciansRes, maintenanceRes] = await Promise.all([
    supabase
      .from('service_calls')
      .select(`*, client:client_id ( name ), equipment:equipment_id ( brand, model, environment ), technician:technician_id ( profile:profile_id ( full_name ) )`)
      .in('status', OPEN_STATUSES)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('technicians')
      .select('id, status, active, profile:profile_id ( full_name )')
      .eq('active', true)
      .order('status', { ascending: true })
      .limit(30),
    supabase
      .from('maintenance_schedules')
      .select('id')
      .eq('active', true)
      .gte('next_due_at', now.toISOString())
      .lte('next_due_at', inSevenDays.toISOString())
      .limit(100),
  ]);

  if (callsRes.error) throw new Error(callsRes.error.message);
  if (techniciansRes.error) throw new Error(techniciansRes.error.message);
  if (maintenanceRes.error) throw new Error(maintenanceRes.error.message);

  const calls = (callsRes.data ?? []) as AdminCall[];
  const technicians = (techniciansRes.data ?? []) as AdminTechnician[];
  const maintenanceDue = maintenanceRes.data?.length ?? 0;

  return {
    calls,
    technicians,
    maintenanceDue,
    totals: {
      open: calls.length,
      urgent: calls.filter((call) => call.priority === 'urgente').length,
      techniciansAvailable: technicians.filter((technician) => technician.status === 'disponivel').length,
    },
  };
}

export function technicianStatusLabel(status: TechnicianStatus) {
  return {
    disponivel: 'Disponível',
    em_atendimento: 'Em atendimento',
    a_caminho: 'A caminho',
    indisponivel: 'Indisponível',
  }[status];
}
