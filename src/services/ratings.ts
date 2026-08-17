import { supabase } from '@/lib/supabase';

export type ServiceRatingInput = { serviceCallId: string; rating: number; punctual: boolean | null; equipmentCondition: 'perfeito' | 'parcial' | 'problemas'; feeling: 'triste' | 'neutro' | 'feliz' | 'otimo' | 'apaixonado'; comment: string };

export async function submitServiceRating(input: ServiceRatingInput) {
  const { data: client, error: clientError } = await (supabase as any).from('clients').select('id').eq('profile_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client?.id) throw new Error('Cliente autenticado não encontrado.');
  const { error } = await (supabase as any).from('service_ratings').upsert({ service_call_id: input.serviceCallId, client_id: client.id, rating: input.rating, punctual: input.punctual, equipment_condition: input.equipmentCondition, feeling: input.feeling, comment: input.comment.trim() || null }, { onConflict: 'service_call_id' });
  if (error) throw new Error(error.message);
}
