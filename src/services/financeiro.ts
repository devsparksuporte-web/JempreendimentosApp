import { supabase } from '@/lib/supabase';

/**
 * Financeiro: contratos, faturas e orçamentos.
 *
 * As tabelas `financial_entries`, `quotations` e `quotation_items` existem
 * desde a 0001 e nunca tinham sido usadas. A 0030 acrescentou o contrato
 * mensal, abriu a leitura das faturas para o cliente e criou a função que
 * deixa ele responder ao orçamento.
 *
 * Quem enxerga o quê continua sendo decidido pela RLS: a administração vê
 * tudo, e o cliente vê os contratos dele, as contas A RECEBER dele e os
 * orçamentos dele. Despesa da empresa (`type = 'pagar'`) não sai da
 * administração.
 */

export type TipoLancamento = 'pagar' | 'receber';
export type StatusLancamento = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado';

export const ROTULO_LANCAMENTO: Record<StatusLancamento, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const ROTULO_ORCAMENTO: Record<StatusOrcamento, string> = {
  rascunho: 'Rascunho',
  enviado: 'Aguardando cliente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
};

// ---------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------

export type Contrato = {
  id: string;
  client_id: string;
  description: string;
  amount: number;
  billing_day: number;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  notes: string | null;
  client: { name: string } | null;
};

const SELECT_CONTRATO =
  'id, client_id, description, amount, billing_day, starts_on, ends_on, active, notes, client:client_id ( name )';

export async function fetchContratos(): Promise<Contrato[]> {
  const { data, error } = await (supabase as any)
    .from('service_contracts')
    .select(SELECT_CONTRATO)
    .order('active', { ascending: false })
    .order('starts_on', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as Contrato[];
}

export async function salvarContrato(
  id: string | null,
  dados: {
    client_id: string;
    description: string;
    amount: number;
    billing_day: number;
    starts_on: string;
    ends_on: string | null;
    active: boolean;
    notes: string | null;
  },
): Promise<string> {
  if (id) {
    const { error } = await (supabase as any)
      .from('service_contracts')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await (supabase as any)
    .from('service_contracts')
    .insert(dados)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

// ---------------------------------------------------------------------
// Faturas e despesas
// ---------------------------------------------------------------------

export type Lancamento = {
  id: string;
  type: TipoLancamento;
  status: StatusLancamento;
  description: string;
  category: string | null;
  amount: number;
  due_date: string;
  paid_at: string | null;
  client_id: string | null;
  service_call_id: string | null;
  contract_id: string | null;
  client: { name: string } | null;
};

const SELECT_LANCAMENTO =
  'id, type, status, description, category, amount, due_date, paid_at, client_id, service_call_id, contract_id, client:client_id ( name )';

/**
 * Lançamentos de um período.
 *
 * O recorte é por vencimento, não por criação: quem olha o financeiro quer
 * saber o que vence neste mês, não o que foi digitado neste mês.
 */
export async function fetchLancamentos(de: string, ate: string): Promise<Lancamento[]> {
  const { data, error } = await (supabase as any)
    .from('financial_entries')
    .select(SELECT_LANCAMENTO)
    .gte('due_date', de)
    .lte('due_date', ate)
    .order('due_date', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Lancamento[];
}

/** O que o cliente deve, em aberto. A RLS já limita ao próprio cliente. */
export async function fetchMinhasFaturas(): Promise<Lancamento[]> {
  const { data, error } = await (supabase as any)
    .from('financial_entries')
    .select(SELECT_LANCAMENTO)
    .eq('type', 'receber')
    .neq('status', 'cancelado')
    .order('due_date', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Lancamento[];
}

export async function criarLancamento(dados: {
  type: TipoLancamento;
  description: string;
  category?: string | null;
  amount: number;
  due_date: string;
  client_id?: string | null;
  service_call_id?: string | null;
}): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('financial_entries')
    .insert({ ...dados, status: 'pendente' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/**
 * Baixa do pagamento.
 *
 * `paid_at` é a data em que entrou, e não a de vencimento: é ela que diz se
 * o cliente pagou em dia.
 */
export async function darBaixa(id: string, quando = new Date()): Promise<void> {
  const dia = quando.toISOString().slice(0, 10);
  const { error } = await (supabase as any)
    .from('financial_entries')
    .update({ status: 'pago', paid_at: dia, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function cancelarLancamento(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('financial_entries')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Gera as faturas dos contratos ativos. Repetir não duplica: ver 0030. */
export async function gerarFaturasDoMes(referencia?: Date): Promise<number> {
  const { data, error } = await (supabase as any).rpc('gerar_faturas_do_mes', {
    p_referencia: (referencia ?? new Date()).toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ---------------------------------------------------------------------
// Orçamentos
// ---------------------------------------------------------------------

export type ItemOrcamento = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
};

export type Orcamento = {
  id: string;
  service_call_id: string | null;
  client_id: string;
  status: StatusOrcamento;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  client: { name: string } | null;
  items: ItemOrcamento[];
};

const SELECT_ORCAMENTO = `
  id, service_call_id, client_id, status, total, valid_until, notes, created_at,
  client:client_id ( name ),
  items:quotation_items ( id, description, quantity, unit_price )
`;

export async function fetchOrcamentos(): Promise<Orcamento[]> {
  const { data, error } = await (supabase as any)
    .from('quotations')
    .select(SELECT_ORCAMENTO)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Orcamento[];
}

export async function fetchOrcamento(id: string): Promise<Orcamento> {
  const { data, error } = await (supabase as any)
    .from('quotations')
    .select(SELECT_ORCAMENTO)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Orcamento;
}

/**
 * Cria o orçamento com os itens e acerta o total.
 *
 * O total é somado aqui e gravado na tabela em vez de calculado na leitura:
 * um orçamento aprovado precisa valer pelo que foi mostrado ao cliente, e
 * não mudar de valor porque alguém corrigiu o preço de uma peça depois.
 */
export async function criarOrcamento(dados: {
  clientId: string;
  serviceCallId?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  itens: { description: string; quantity: number; unit_price: number }[];
}): Promise<string> {
  const total = dados.itens.reduce((soma, i) => soma + i.quantity * i.unit_price, 0);

  const { data, error } = await (supabase as any)
    .from('quotations')
    .insert({
      client_id: dados.clientId,
      service_call_id: dados.serviceCallId ?? null,
      valid_until: dados.validUntil ?? null,
      notes: dados.notes?.trim() || null,
      status: 'rascunho',
      total,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const id = (data as { id: string }).id;
  if (dados.itens.length > 0) {
    const { error: falhaItens } = await (supabase as any)
      .from('quotation_items')
      .insert(dados.itens.map((i) => ({ ...i, quotation_id: id })));
    if (falhaItens) throw new Error(falhaItens.message);
  }
  return id;
}

/** Envia ao cliente. Só a partir daqui ele pode responder (ver 0030). */
export async function enviarOrcamento(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('quotations')
    .update({ status: 'enviado', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Resposta do cliente.
 *
 * Passa por função no banco porque liberar escrita direta deixaria o cliente
 * mexer no total e nos itens do próprio orçamento. A função aceita uma
 * transição só, e apenas no orçamento dele.
 */
export async function responderOrcamento(
  id: string,
  aprovado: boolean,
  observacao?: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc('responder_orcamento', {
    p_quotation: id,
    p_aprovado: aprovado,
    p_observacao: observacao?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------

export function emReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function estaAtrasado(l: Lancamento): boolean {
  return l.status === 'pendente' && l.due_date < new Date().toISOString().slice(0, 10);
}

/** Totais de um período, para os cartões do topo da tela. */
export function totalizar(lancamentos: Lancamento[]) {
  const receber = lancamentos.filter((l) => l.type === 'receber');
  const pagar = lancamentos.filter((l) => l.type === 'pagar');
  const soma = (lista: Lancamento[]) => lista.reduce((t, l) => t + Number(l.amount), 0);

  return {
    aReceber: soma(receber.filter((l) => l.status === 'pendente')),
    recebido: soma(receber.filter((l) => l.status === 'pago')),
    aPagar: soma(pagar.filter((l) => l.status === 'pendente')),
    atrasado: soma(lancamentos.filter(estaAtrasado)),
  };
}
