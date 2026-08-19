import { supabase } from '@/lib/supabase';

export type InventoryRow = { part_id: string; quantity: number; min_quantity: number; location: string | null; part: { name: string; sku: string | null; unit: string | null } | null };
export type PmocRow = { id: string; title: string; start_date: string; end_date: string | null; client: { name: string } | null; items: Array<{ id: string; routine: string; next_execution: string | null; equipment: { brand: string | null; model: string | null; environment: string | null } | null }> };

export async function fetchInventory(): Promise<InventoryRow[]> {
  const { data, error } = await (supabase as any).from('inventory').select('part_id, quantity, min_quantity, location, part:part_id ( name, sku, unit )').order('quantity', { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as InventoryRow[];
}

export async function fetchPmoc(): Promise<PmocRow[]> {
  const { data, error } = await (supabase as any).from('pmoc').select('id, title, start_date, end_date, client:client_id ( name ), items:pmoc_items ( id, routine, next_execution, equipment:equipment_id ( brand, model, environment ) )').eq('active', true).order('start_date', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as PmocRow[];
}
