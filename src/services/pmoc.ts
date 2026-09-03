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

/** Seção 4 do PMOC: um ambiente climatizado, não um equipamento. */
export type PmocEnvironment = {
  id: string;
  activity: string;
  name: string;
  occupants_fixed: number;
  occupants_floating: number;
  area_m2: number | null;
  thermal_load_btu: number | null;
  ordem: number;
};

export type PmocItem = {
  id: string;
  routine: string;
  /** Código do catálogo da norma ('4.9'), quando a rotina veio de lá. */
  catalog_code: string | null;
  /** Q, M, B, T, S ou A. Manda no reagendamento desde a 0031. */
  periodicidade: string | null;
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
  art_trt: string | null;
  contract_term: string | null;
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
    council_registration: string | null;
    profile: { full_name: string } | null;
  } | null;
  environments: PmocEnvironment[];
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
  id, title, start_date, end_date, active, art_trt, contract_term,
  client:client_id ( id, name, doc ),
  address:address_id ( street, number, district, city, state, zip_code ),
  responsible:responsible_id ( id, registration, council_registration, profile:profile_id ( full_name ) ),
  environments:pmoc_environments ( id, activity, name, occupants_fixed, occupants_floating, area_m2, thermal_load_btu, ordem ),
  items:pmoc_items (
    id, routine, catalog_code, periodicidade, frequency_months, last_execution, next_execution, notes,
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

// ---------------------------------------------------------------------
// Catálogo da norma e ambientes (0031)
// ---------------------------------------------------------------------

export type RotinaDoCatalogo = {
  code: string;
  grupo: number;
  grupo_nome: string;
  descricao: string;
  periodicidade: string;
  ordem: number;
};

export const ROTULO_PERIODICIDADE: Record<string, string> = {
  Q: 'Quinzenal',
  M: 'Mensal',
  B: 'Bimestral',
  T: 'Trimestral',
  S: 'Semestral',
  A: 'Anual',
};

/** As 44 rotinas da norma, na ordem em que aparecem no documento. */
export async function fetchCatalogoDeRotinas(): Promise<RotinaDoCatalogo[]> {
  const { data, error } = await (supabase as any)
    .from('pmoc_routine_catalog')
    .select('code, grupo, grupo_nome, descricao, periodicidade, ordem')
    .order('ordem', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RotinaDoCatalogo[];
}

/**
 * Cria as 44 rotinas para um equipamento do plano.
 *
 * Repetir não duplica — o banco garante isso pelo par (plano, equipamento,
 * código). Devolve quantas foram criadas de fato.
 */
export async function aplicarCatalogo(pmocId: string, equipmentId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc('aplicar_catalogo_pmoc', {
    p_pmoc: pmocId,
    p_equipment: equipmentId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function salvarAmbiente(
  pmocId: string,
  dados: Omit<PmocEnvironment, 'id'> & { id?: string },
): Promise<void> {
  const campos = {
    pmoc_id: pmocId,
    activity: dados.activity,
    name: dados.name,
    occupants_fixed: dados.occupants_fixed,
    occupants_floating: dados.occupants_floating,
    area_m2: dados.area_m2,
    thermal_load_btu: dados.thermal_load_btu,
    ordem: dados.ordem,
  };
  const q = (supabase as any).from('pmoc_environments');
  const { error } = dados.id ? await q.update(campos).eq('id', dados.id) : await q.insert(campos);
  if (error) throw new Error(error.message);
}

export async function removerAmbiente(id: string): Promise<void> {
  const { error } = await (supabase as any).from('pmoc_environments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Agrupa as rotinas do plano por grupo da norma, para a tabela do documento. */
export function agruparPorGrupo(itens: PmocItem[], catalogo: RotinaDoCatalogo[]) {
  const porCodigo = new Map(catalogo.map((c) => [c.code, c]));
  const grupos = new Map<number, { nome: string; linhas: { code: string; descricao: string; periodicidade: string }[] }>();

  for (const item of itens) {
    if (!item.catalog_code) continue;
    const ref = porCodigo.get(item.catalog_code);
    if (!ref) continue;
    if (!grupos.has(ref.grupo)) grupos.set(ref.grupo, { nome: ref.grupo_nome, linhas: [] });
    const grupo = grupos.get(ref.grupo);
    if (!grupo || grupo.linhas.some((l) => l.code === ref.code)) continue;
    grupo.linhas.push({
      code: ref.code,
      descricao: ref.descricao,
      periodicidade: item.periodicidade ?? ref.periodicidade,
    });
  }

  return [...grupos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, g]) => ({
      numero,
      nome: g.nome,
      linhas: g.linhas.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true })),
    }));
}
