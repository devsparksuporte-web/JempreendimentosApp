import { supabase } from '@/lib/supabase';
import type { ServiceCall } from '@/types/database';

export type AgendaEntry = Pick<ServiceCall, 'id' | 'code' | 'title' | 'status' | 'priority' | 'service_type' | 'scheduled_for' | 'client_id' | 'technician_id'> & {
  client: { name: string } | null;
  equipment: { brand: string | null; model: string | null; environment: string | null } | null;
};

export async function fetchAgendaEntries(from: string, to: string): Promise<AgendaEntry[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select('id, code, title, status, priority, service_type, scheduled_for, client_id, technician_id, client:client_id ( name ), equipment:equipment_id ( brand, model, environment )')
    .not('scheduled_for', 'is', null)
    .gte('scheduled_for', from)
    .lt('scheduled_for', to)
    .order('scheduled_for', { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as AgendaEntry[];
}
