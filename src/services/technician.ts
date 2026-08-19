import * as ImagePicker from 'expo-image-picker';
import { garantirPermissao } from '@/lib/permissoes';
import { supabase } from '@/lib/supabase';
import type { EquipmentConditionLevel, ServiceCall, ServiceCallStatusHistory } from '@/types/database';

export type TechnicianCall = ServiceCall & {
  client: { name: string; phone: string | null } | null;
  equipment: { id: string; brand: string | null; model: string | null; environment: string | null; gas_type: string | null; btu_capacity: number | null; serial_number: string | null } | null;
  address: { street: string; number: string | null; district: string | null; city: string; state: string | null; zip_code: string | null } | null;
};

export type ChecklistItem = { id: string; label: string; help_text: string | null; input_type: 'boolean' | 'text' | 'number' | 'photo'; required: boolean; order_index: number };
export type TechnicianPhoto = { id: string; stage: 'antes' | 'durante' | 'depois'; storage_path: string; caption: string | null; taken_at: string };

const OPEN_STATUSES: ServiceCall['status'][] = ['aberto', 'em_analise', 'aguardando_tecnico', 'tecnico_atribuido', 'a_caminho', 'em_atendimento', 'aguardando_peca', 'aguardando_aprovacao'];

export async function fetchTechnicianCalls(): Promise<TechnicianCall[]> {
  const { data, error } = await supabase
    .from('service_calls')
    .select(`*, client:client_id ( name, phone ), equipment:equipment_id ( id, brand, model, environment, gas_type, btu_capacity, serial_number ), address:address_id ( street, number, district, city, state, zip_code )`)
    .in('status', OPEN_STATUSES)
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TechnicianCall[];
}

export async function findTechnicianCallByEquipment(equipmentId: string): Promise<TechnicianCall> {
  const { data, error } = await supabase.from('service_calls').select(`*, client:client_id ( name, phone ), equipment:equipment_id ( id, brand, model, environment, gas_type, btu_capacity, serial_number ), address:address_id ( street, number, district, city, state, zip_code )`).eq('equipment_id', equipmentId).in('status', OPEN_STATUSES).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Nenhum chamado aberto está atribuído a este equipamento.');
  return data as TechnicianCall;
}

export async function fetchTechnicianCall(id: string): Promise<TechnicianCall> {
  const { data, error } = await supabase.from('service_calls').select(`*, client:client_id ( name, phone ), equipment:equipment_id ( id, brand, model, environment, gas_type, btu_capacity, serial_number ), address:address_id ( street, number, district, city, state, zip_code )`).eq('id', id).limit(1).single();
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

/**
 * Envia a foto para o Storage.
 *
 * Carregar o arquivo no heap com `arrayBuffer()` não é ideal — foi parte do
 * que fazia o Android matar o app com LOW_MEMORY na segunda evidência. A
 * alternativa de transmitir do disco via FormData foi tentada e o
 * NetworkingModule do Android a recusou com "Unsupported FormDataPart
 * implementation", então este é o caminho que de fato funciona nesta versão.
 *
 * A pressão de memória foi atacada por outros dois lados: a câmera devolve
 * imagem mais leve (quality 0.6) e a exibição usa expo-image, que reduz na
 * decodificação em vez de abrir o bitmap inteiro.
 *
 * A correção de raiz é redimensionar antes de enviar, com
 * expo-image-manipulator. É módulo nativo e exige APK novo — quando houver
 * rebuild, o lugar de encaixar é aqui, e só aqui.
 */
async function enviarArquivo(
  bucket: string,
  path: string,
  uri: string,
  mimeType: string,
): Promise<void> {
  const body = await fetch(uri).then((response) => response.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
}

export async function captureAndUploadPhoto(serviceCall: TechnicianCall, stage: TechnicianPhoto['stage']) {
  // Reverifica na hora do uso: o assistente inicial não garante nada para
  // sempre, e a permissão pode ter sido revogada nas configurações.
  const permissao = await garantirPermissao('camera');
  if (!permissao.ok) throw new Error(permissao.mensagem ?? 'Permissão de câmera necessária.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  const path = `service/${serviceCall.client_id}/${serviceCall.id}/${stage}/${Date.now()}.${extension}`;
  await enviarArquivo('service-photos', path, asset.uri, asset.mimeType ?? 'image/jpeg');
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

export async function technicianUpdateServiceCall(input: {
  callId: string;
  title?: string;
  description?: string | null;
  diagnosis?: string | null;
  solution?: string | null;
  equipmentCondition?: EquipmentConditionLevel | null;
}) {
  const { error } = await (supabase as any).rpc('technician_update_service_call', {
    p_call_id: input.callId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_diagnosis: input.diagnosis ?? null,
    p_solution: input.solution ?? null,
    p_equipment_condition: input.equipmentCondition ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function pickAndUploadPhoto(serviceCall: TechnicianCall, stage: TechnicianPhoto['stage']) {
  const permissao = await garantirPermissao('midia');
  if (!permissao.ok) throw new Error(permissao.mensagem ?? 'Permissão da galeria necessária.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  const path = `service/${serviceCall.client_id}/${serviceCall.id}/${stage}/${Date.now()}.${extension}`;
  await enviarArquivo('service-photos', path, asset.uri, asset.mimeType ?? 'image/jpeg');
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await (supabase as any).from('service_photos').insert({ service_call_id: serviceCall.id, equipment_id: serviceCall.equipment_id, stage, storage_path: path, taken_by: auth.user?.id ?? null }).select('id, stage, storage_path, caption, taken_at').limit(1).single();
  if (error) throw new Error(error.message);
  return data as TechnicianPhoto;
}
