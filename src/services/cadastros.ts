import { supabase } from '@/lib/supabase';

/**
 * Cadastros básicos da operação: cliente, endereço e equipamento.
 *
 * Até aqui esses dados só entravam pelo SQL Editor. Sem eles o app não sai
 * do lugar — não há chamado sem cliente, nem rota sem endereço, nem
 * atendimento sem equipamento.
 *
 * A escrita é do administrador; a RLS já garantia isso, o que faltava era
 * interface.
 */

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export type Cliente = {
  id: string;
  profile_id: string | null;
  name: string;
  doc: string | null;
  doc_type: 'cpf' | 'cnpj' | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
};

export type EdicaoCliente = Omit<Cliente, 'id' | 'profile_id'>;

/** Conta de acesso ainda sem dono, usada tanto por cliente quanto por técnico. */
export type PerfilLivre = { id: string; full_name: string; email: string | null; role: string };

export const CLIENTE_VAZIO: EdicaoCliente = {
  name: '',
  doc: null,
  doc_type: null,
  phone: null,
  whatsapp: null,
  email: null,
  notes: null,
  active: true,
};

const CAMPOS_CLIENTE = 'id, profile_id, name, doc, doc_type, phone, whatsapp, email, notes, active';

export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await (supabase as any)
    .from('clients')
    .select(CAMPOS_CLIENTE)
    .order('name')
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Cliente[];
}

export async function fetchCliente(id: string): Promise<Cliente> {
  const { data, error } = await (supabase as any)
    .from('clients')
    .select(CAMPOS_CLIENTE)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Cliente;
}

export async function salvarCliente(id: string | null, dados: EdicaoCliente): Promise<string> {
  if (id) {
    const { error } = await (supabase as any)
      .from('clients')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await (supabase as any)
    .from('clients')
    .insert(dados)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Endereços
// ---------------------------------------------------------------------------

export type Endereco = {
  id: string;
  client_id: string;
  label: string;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string;
  state: string | null;
  zip_code: string | null;
  is_primary: boolean;
};

export type EdicaoEndereco = Omit<Endereco, 'id' | 'client_id'>;

export const ENDERECO_VAZIO: EdicaoEndereco = {
  label: 'Principal',
  street: '',
  number: null,
  complement: null,
  district: null,
  city: '',
  state: null,
  zip_code: null,
  is_primary: true,
};

/**
 * Contas que podem virar o acesso deste cliente.
 *
 * São os perfis com papel de cliente que ainda não estão ligados a
 * nenhum cadastro. O vínculo é um-para-um: `clients.profile_id` é único,
 * então uma conta não pode responder por duas empresas.
 *
 * Administrador e técnico ficam de fora: o papel deles decide o que veem
 * no aplicativo, e ligar um técnico a um cadastro de cliente só criaria
 * confusão sobre qual portal ele deveria abrir.
 */
export async function fetchPerfisParaCliente(): Promise<PerfilLivre[]> {
  const { data: perfis, error } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('active', true)
    .eq('role', 'cliente')
    .order('full_name');
  if (error) throw new Error(error.message);

  const { data: ligados } = await (supabase as any)
    .from('clients')
    .select('profile_id')
    .not('profile_id', 'is', null);
  const jaTem = new Set(
    ((ligados ?? []) as { profile_id: string }[]).map((v) => v.profile_id),
  );
  return ((perfis ?? []) as PerfilLivre[]).filter((p) => !jaTem.has(p.id));
}

/**
 * Liga (ou desliga) a conta de acesso ao cadastro do cliente.
 *
 * É isto que faz `my_client_id()` encontrar alguma coisa. Sem o vínculo,
 * a pessoa entra no aplicativo e não enxerga chamado, equipamento nem
 * laudo nenhum — o cadastro existe só para a administração.
 */
export async function vincularContaDoCliente(
  clientId: string,
  profileId: string | null,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('clients')
    .update({ profile_id: profileId, updated_at: new Date().toISOString() })
    .eq('id', clientId);
  if (error) throw new Error(error.message);
}

export async function fetchEnderecos(clientId: string): Promise<Endereco[]> {
  const { data, error } = await (supabase as any)
    .from('client_addresses')
    .select('id, client_id, label, street, number, complement, district, city, state, zip_code, is_primary')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('label');
  if (error) throw new Error(error.message);
  return (data ?? []) as Endereco[];
}

export async function salvarEndereco(
  id: string | null,
  clientId: string,
  dados: EdicaoEndereco,
): Promise<string> {
  // Um principal por cliente: marcar um novo desmarca o anterior. Sem isso a
  // rota do técnico sortearia qual endereço usar.
  if (dados.is_primary) {
    await (supabase as any)
      .from('client_addresses')
      .update({ is_primary: false })
      .eq('client_id', clientId);
  }

  if (id) {
    const { error } = await (supabase as any)
      .from('client_addresses')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await (supabase as any)
    .from('client_addresses')
    .insert({ ...dados, client_id: clientId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** O que a consulta de CEP consegue preencher sozinha. */
export type EnderecoPorCep = {
  street: string;
  district: string;
  city: string;
  state: string;
};

/**
 * Consulta o CEP nos Correios via ViaCEP.
 *
 * Serviço público e sem chave — não há segredo a proteger aqui. Falha de rede
 * devolve null em vez de erro: o cadastro tem que continuar possível na mão,
 * inclusive em campo sem sinal.
 */
export async function buscarCep(cep: string): Promise<EnderecoPorCep | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    // CEP inexistente volta com 200 e { erro: true }.
    if (dados.erro) return null;

    return {
      street: dados.logradouro ?? '',
      district: dados.bairro ?? '',
      city: dados.localidade ?? '',
      state: dados.uf ?? '',
    };
  } catch {
    return null;
  }
}

export async function excluirEndereco(id: string): Promise<void> {
  const { error } = await (supabase as any).from('client_addresses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------------

export type Equipamento = {
  id: string;
  client_id: string;
  address_id: string | null;
  environment: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  kind: string | null;
  btu_capacity: number | null;
  gas_type: string | null;
  technology: string | null;
  installed_at: string | null;
  warranty_until: string | null;
  notes: string | null;
  active: boolean;
  client?: { name: string } | null;
};

export type EdicaoEquipamento = Omit<Equipamento, 'id' | 'client'>;

export function equipamentoVazio(clientId: string): EdicaoEquipamento {
  return {
    client_id: clientId,
    address_id: null,
    environment: null,
    brand: null,
    model: null,
    serial_number: null,
    kind: 'split',
    btu_capacity: null,
    gas_type: null,
    technology: null,
    installed_at: null,
    warranty_until: null,
    notes: null,
    active: true,
  };
}

export const TIPOS_EQUIPAMENTO = ['split', 'cassete', 'janela', 'multi-split', 'piso-teto'];
export const GASES = ['R410A', 'R32', 'R22', 'R134a'];
export const TECNOLOGIAS = ['inverter', 'convencional'];

const CAMPOS_EQUIPAMENTO = `
  id, client_id, address_id, environment, brand, model, serial_number, kind,
  btu_capacity, gas_type, technology, installed_at, warranty_until, notes, active,
  client:client_id ( name )
`;

export async function fetchEquipamentos(clientId?: string): Promise<Equipamento[]> {
  let consulta = (supabase as any).from('equipment').select(CAMPOS_EQUIPAMENTO).order('created_at', {
    ascending: false,
  });
  if (clientId) consulta = consulta.eq('client_id', clientId);

  const { data, error } = await consulta.limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Equipamento[];
}

export async function fetchEquipamento(id: string): Promise<Equipamento> {
  const { data, error } = await (supabase as any)
    .from('equipment')
    .select(CAMPOS_EQUIPAMENTO)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Equipamento;
}

export async function salvarEquipamento(
  id: string | null,
  dados: EdicaoEquipamento,
): Promise<string> {
  if (id) {
    const { error } = await (supabase as any)
      .from('equipment')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await (supabase as any)
    .from('equipment')
    .insert(dados)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Texto do QR Code colado no aparelho — é o que a leitura do técnico espera. */
export function conteudoQrDoEquipamento(id: string): string {
  return `jempreendimentos://equipamento/${id}`;
}

// ---------------------------------------------------------------------------
// Técnicos
//
// O cadastro aqui é do VÍNCULO técnico, não da conta de acesso. `profile_id`
// é obrigatório e aponta para um perfil já existente, criado quando a pessoa
// se cadastra no aplicativo. Criar login por aqui exigiria a chave de
// serviço do Supabase dentro do app — que é justamente o que não se faz.
// ---------------------------------------------------------------------------

export type Tecnico = {
  id: string;
  profile_id: string;
  registration: string | null;
  specialties: string[];
  status: 'disponivel' | 'em_atendimento' | 'a_caminho' | 'indisponivel';
  active: boolean;
  profile: { full_name: string; email: string | null; phone: string | null } | null;
};

export async function fetchTecnicos(): Promise<Tecnico[]> {
  const { data, error } = await (supabase as any)
    .from('technicians')
    .select('id, profile_id, registration, specialties, status, active, profile:profile_id ( full_name, email, phone )')
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Tecnico[];
}

/** Perfis com papel de técnico que ainda não têm vínculo criado. */
export async function fetchPerfisSemVinculo(): Promise<PerfilLivre[]> {
  const { data: perfis, error } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('role', 'tecnico')
    .eq('active', true);
  if (error) throw new Error(error.message);

  const { data: vinculados } = await (supabase as any).from('technicians').select('profile_id');
  const jaTem = new Set(((vinculados ?? []) as { profile_id: string }[]).map((v) => v.profile_id));
  return ((perfis ?? []) as PerfilLivre[]).filter((p) => !jaTem.has(p.id));
}

export async function salvarTecnico(
  id: string | null,
  dados: {
    profile_id: string;
    registration: string | null;
    specialties: string[];
    active: boolean;
  },
): Promise<string> {
  if (id) {
    const { error } = await (supabase as any)
      .from('technicians')
      .update({
        registration: dados.registration,
        specialties: dados.specialties,
        active: dados.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await (supabase as any)
    .from('technicians')
    .insert(dados)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/**
 * Perfis que podem virar técnico.
 *
 * Inclui quem ainda está como cliente, porque nenhum cadastro nasce
 * técnico: o `signUp` grava sempre 'cliente'. Sem poder promover por
 * aqui, a lista de vínculo ficaria eternamente vazia e a única saída
 * seria mexer no banco à mão.
 *
 * Administrador fica de fora de propósito. Se o único administrador se
 * promovesse a técnico, perderia o próprio acesso de administração — e
 * não sobraria ninguém com poder para desfazer.
 */
export async function fetchPerfisDisponiveis(): Promise<PerfilLivre[]> {
  const { data: perfis, error } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('active', true)
    .neq('role', 'admin')
    .order('full_name');
  if (error) throw new Error(error.message);

  const { data: vinculados } = await (supabase as any).from('technicians').select('profile_id');
  const jaTem = new Set(((vinculados ?? []) as { profile_id: string }[]).map((v) => v.profile_id));
  return ((perfis ?? []) as PerfilLivre[]).filter((p) => !jaTem.has(p.id));
}

/**
 * Muda o papel do perfil para técnico.
 *
 * Não é cosmético: o papel decide quais telas a pessoa vê e o que a RLS
 * deixa ela ler. Quem era cliente perde o portal do cliente ao virar
 * técnico, então a tela pergunta antes.
 */
export async function promoverParaTecnico(profileId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ role: 'tecnico' })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
}

export const ROTULO_ESPECIALIDADE: Record<string, string> = {
  instalacao: 'Instalação',
  manutencao_preventiva: 'Preventiva',
  manutencao_corretiva: 'Corretiva',
  higienizacao: 'Higienização',
  carga_gas: 'Carga de gás',
  eletrica: 'Elétrica',
};

export const ROTULO_STATUS_TECNICO: Record<Tecnico['status'], string> = {
  disponivel: 'Disponível',
  em_atendimento: 'Em atendimento',
  a_caminho: 'A caminho',
  indisponivel: 'Indisponível',
};

export const ESPECIALIDADES = [
  'instalacao',
  'manutencao_preventiva',
  'manutencao_corretiva',
  'higienizacao',
  'carga_gas',
  'eletrica',
];
