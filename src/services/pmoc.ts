import { supabase } from '@/lib/supabase';

/**
 * PMOC — Plano de Manutenção, Operação e Controle.
 *
 * A fiscalização sanitária exige comprovar QUAL rotina foi feita, QUANDO e
 * POR QUEM. Por isso cada execução vira uma linha em `pmoc_executions`, e o
 * certificado congela os dados do responsável técnico no momento da emissão.
 */

export type PmocEquipment = {
  id: string;
  brand: string | null;
  model: string | null;
  environment: string | null;
  btu_capacity: number | null;
  serial_number: string | null;
};

export type PmocExecution = {
  id: string;
  executed_at: string;
  conforme: boolean;
  notes: string | null;
  technician: { profile: { full_name: string } | null } | null;
};

export type PmocItem = {
  id: string;
  routine: string;
  frequency_months: number;
  last_execution: string | null;
  next_execution: string | null;
  notes: string | null;
  equipment: PmocEquipment | null;
  executions: PmocExecution[];
};

export type PmocPlan = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  client: { id: string; name: string; doc: string | null } | null;
  address: {
    street: string;
    number: string | null;
    district: string | null;
    city: string;
    state: string | null;
    zip_code: string | null;
  } | null;
  responsible: {
    id: string;
    registration: string | null;
    profile: { full_name: string } | null;
  } | null;
  items: PmocItem[];
};

export type PmocCertificate = {
  id: string;
  number: string;
  period_start: string;
  period_end: string;
  responsible_name: string;
  responsible_registration: string | null;
  signer_name: string | null;
  issued_at: string;
};

const PLAN_SELECT = `
  id, title, start_date, end_date, active,
  client:client_id ( id, name, doc ),
  address:address_id ( street, number, district, city, state, zip_code ),
  responsible:responsible_id ( id, registration, profile:profile_id ( full_name ) ),
  items:pmoc_items (
    id, routine, frequency_months, last_execution, next_execution, notes,
    equipment:equipment_id ( id, brand, model, environment, btu_capacity, serial_number ),
    executions:pmoc_executions (
      id, executed_at, conforme, notes,
      technician:technician_id ( profile:profile_id ( full_name ) )
    )
  )
`;

export async function fetchPmocPlans(): Promise<PmocPlan[]> {
  const { data, error } = await supabase
    .from('pmoc')
    .select(PLAN_SELECT)
    .eq('active', true)
    .order('start_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PmocPlan[];
}

export async function fetchPmocPlan(id: string): Promise<PmocPlan> {
  const { data, error } = await supabase.from('pmoc').select(PLAN_SELECT).eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as unknown as PmocPlan;
}

/** Registra a execução de uma rotina. O trigger recalcula a próxima data. */
export async function registrarExecucao(input: {
  itemId: string;
  conforme: boolean;
  notes?: string | null;
}): Promise<void> {
  const { data: tech } = await supabase.from('technicians').select('id').maybeSingle();

  const { error } = await supabase.from('pmoc_executions').insert({
    pmoc_item_id: input.itemId,
    technician_id: tech?.id ?? null,
    conforme: input.conforme,
    notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchCertificados(pmocId: string): Promise<PmocCertificate[]> {
  const { data, error } = await supabase
    .from('pmoc_certificates')
    .select('id, number, period_start, period_end, responsible_name, responsible_registration, signer_name, issued_at')
    .eq('pmoc_id', pmocId)
    .order('issued_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PmocCertificate[];
}

/**
 * Emite o certificado do período. Os dados do responsável são copiados para
 * a linha: se o cadastro do técnico mudar depois, o documento já emitido
 * continua refletindo quem de fato assinou.
 */
export async function emitirCertificado(input: {
  plan: PmocPlan;
  periodStart: string;
  periodEnd: string;
  signerName: string;
}): Promise<PmocCertificate> {
  const { data: numero, error: erroNumero } = await supabase.rpc('next_pmoc_certificate_number');
  if (erroNumero) throw new Error(erroNumero.message);

  const { data, error } = await supabase
    .from('pmoc_certificates')
    .insert({
      pmoc_id: input.plan.id,
      number: numero as unknown as string,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      responsible_name: input.plan.responsible?.profile?.full_name ?? 'Não informado',
      responsible_registration: input.plan.responsible?.registration ?? null,
      signer_name: input.signerName,
    })
    .select('id, number, period_start, period_end, responsible_name, responsible_registration, signer_name, issued_at')
    .single();

  if (error) throw new Error(error.message);
  return data as PmocCertificate;
}

/** Execuções do plano dentro do período, para compor o certificado. */
export function execucoesNoPeriodo(plan: PmocPlan, inicio: string, fim: string) {
  const de = new Date(inicio).getTime();
  const ate = new Date(fim).getTime() + 86_399_000;

  return plan.items.flatMap((item) =>
    (item.executions ?? [])
      .filter((e) => {
        const t = new Date(e.executed_at).getTime();
        return t >= de && t <= ate;
      })
      .map((e) => ({ item, execucao: e })),
  );
}
