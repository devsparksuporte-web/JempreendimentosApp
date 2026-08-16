import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import type { ServiceCall, ServiceCallStatusHistory } from '@/types/database';

export type TechnicianCall = ServiceCall & {
  client: { name: string; phone: string | null } | null;
  equipment: { id: string; brand: string | null; model: string | null; environment: string | null; gas_type: string | null; btu_capacity: number | null } | null;
  address: { street: string; number: string | null; city: string } | null;
};

export type ChecklistItem = { id: string; label: string; help_text: string | null; input_type: 'boolean' | 'text' | 'number' | 'photo'; required: boolean; order_index: number };
export type TechnicianPhoto = { id: string; stage: 'antes' | 'durante' | 'depois'; storage_path: string; caption: string | null; taken_at: string };

const OPEN_STATUSES: ServiceCall['status'][] = ['aberto', 'em_analise', 'aguardando_tecnico', 'tecnico_atribuido', 'a_caminho', 'em_atendimento', 'aguardando_peca', 'aguardando_aprovacao'];

export async function fetchTechnicianCalls(): Promise<TechnicianCall[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(`*, client:client_id ( name, phone ), equipment:equipment_id ( id, brand, model, environment, gas_type, btu_capacity ), address:address_id ( street, number, city )`)
    .in('status', OPEN_STATUSES)
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TechnicianCall[];
}

export async function findTechnicianCallByEquipment(equipmentId: string): Promise<TechnicianCall> {
  const { data, error } = await supabase.from('service_calls').select(`*, client:client_id ( name, phone ), equipment:equipment_id ( id, brand, model, environment, gas_type, btu_capacity ), address:address_id ( street, number, city )`).eq('equipment_id', equipmentId).in('status', OPEN_STATUSES).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Nenhum chamado aberto está atribuído a este equipamento.');
  return data as TechnicianCall;
}

export async function fetchTechnicianCall(id: string): Promise<TechnicianCall> {
  const { data, error } = await supabase.from('service_calls').select(`*, client:client_id ( name, phone ), equipment:equipment_id ( id, brand, model, environment, gas_type, btu_capacity ), address:address_id ( street, number, city )`).eq('id', id).limit(1).single();
  if (error) throw new Error(error.message);
  return data as TechnicianCall;
}

export async function fetchChecklist(serviceType: string): Promise<ChecklistItem[]> {
  const { data, error } = await (supabase as any).from('checklists').select('id, name, checklist_items ( id, label, help_text, input_type, required, order_index )').eq('service_type', serviceType).eq('active', true).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.checklist_items ?? []) as ChecklistItem[]).sort((a, b) => a.order_index - b.order_index);
}

export async function fetchChecklistResults(callId: string) {
  const { data, error } = await (supabase as any).from('service_call_checklist_results').select('checklist_item_id, checked, value, note').eq('service_call_id', callId).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ checklist_item_id: string; checked: boolean; value: string | null; note: string | null }>;
}

export async function saveChecklistResult(input: { serviceCallId: string; itemId: string; checked: boolean; value?: string | null; note?: string | null }) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('service_call_checklist_results').upsert({ service_call_id: input.serviceCallId, checklist_item_id: input.itemId, checked: input.checked, value: input.value ?? null, note: input.note ?? null, completed_by: auth.user?.id ?? null, completed_at: input.checked || input.value ? new Date().toISOString() : null }, { onConflict: 'service_call_id,checklist_item_id' });
  if (error) throw new Error(error.message);
}

export async function fetchServicePhotos(callId: string): Promise<TechnicianPhoto[]> {
  const { data, error } = await (supabase as any).from('service_photos').select('id, stage, storage_path, caption, taken_at').eq('service_call_id', callId).order('taken_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as TechnicianPhoto[];
}

export async function captureAndUploadPhoto(serviceCall: TechnicianCall, stage: TechnicianPhoto['stage']) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Permissão de câmera necessária para registrar a evidência.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.78 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  const path = `service/${serviceCall.client_id}/${serviceCall.id}/${stage}/${Date.now()}.${extension}`;
  const body = await fetch(asset.uri).then((response) => response.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from('service-photos').upload(path, body, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any).from('service_photos').insert({ service_call_id: serviceCall.id, equipment_id: serviceCall.equipment_id, stage, storage_path: path, taken_by: auth.user?.id ?? null }).select('id, stage, storage_path, caption, taken_at').limit(1).single();
  if (error) throw new Error(error.message);
  return data as TechnicianPhoto;
}

export async function updateTechnicianStatus(callId: string, status: ServiceCall['status']) {
  const { error } = await supabase.from('service_calls').update({ status }).eq('id', callId).limit(1);
  if (error) throw new Error(error.message);
}

export async function fetchHistory(callId: string): Promise<ServiceCallStatusHistory[]> {
  const { data, error } = await supabase.from('service_call_status_history').select('*').eq('service_call_id', callId).order('created_at', { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}
