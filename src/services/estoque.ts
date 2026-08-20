import { supabase } from '@/lib/supabase';

/**
 * Módulo de estoque, reposição e fornecedores.
 *
 * Toda escrita de saldo passa pela função `movimentar_estoque` do banco, e
 * nunca por UPDATE direto em `inventory`: é lá que o saldo anterior e o final
 * são gravados na mesma transação do movimento. Alterar a quantidade por
 * fora deixaria histórico e saldo divergentes.
 */

export type Produto = {
  id: string;
  code: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  unit: string;
  cost_price: number | null;
  sale_price: number | null;
  supplier_id: string | null;
  category_id: string | null;
  photo_url: string | null;
  active: boolean;
  /** Vem do join com `inventory`. */
  saldo: number;
  minimo: number;
  maximo: number;
  reposicao: number | null;
  localizacao: string | null;
};

export type NivelEstoque = 'critico' | 'baixo' | 'ok';

/** Três faixas, iguais às usadas pelo banco ao priorizar a solicitação. */
export function nivelDoProduto(p: Pick<Produto, 'saldo' | 'minimo'>): NivelEstoque {
  if (p.saldo <= 0) return 'critico';
  if (p.minimo > 0 && p.saldo <= p.minimo / 2) return 'critico';
  if (p.saldo <= p.minimo) return 'baixo';
  return 'ok';
}

/** Quanto o sistema sugere repor. Zero significa que falta configurar o máximo. */
export function sugestaoDeReposicao(p: Pick<Produto, 'saldo' | 'maximo' | 'reposicao'>): number {
  if (p.reposicao && p.reposicao > 0) return p.reposicao;
  return Math.max(p.maximo - p.saldo, 0);
}

const SELECT_PRODUTO = `
  id, code, sku, name, description, brand, model, unit, cost_price, sale_price,
  supplier_id, category_id, photo_url, active,
  inventory ( quantity, min_quantity, max_quantity, reorder_quantity, location )
`;

type LinhaProduto = Omit<Produto, 'saldo' | 'minimo' | 'maximo' | 'reposicao' | 'localizacao'> & {
  inventory:
    | {
        quantity: number;
        min_quantity: number;
        max_quantity: number;
        reorder_quantity: number | null;
        location: string | null;
      }
    | Array<{
        quantity: number;
        min_quantity: number;
        max_quantity: number;
        reorder_quantity: number | null;
        location: string | null;
      }>
    | null;
};

function achatar(linha: LinhaProduto): Produto {
  const inv = Array.isArray(linha.inventory) ? linha.inventory[0] : linha.inventory;
  const { inventory: _ignorado, ...resto } = linha;
  return {
    ...resto,
    saldo: Number(inv?.quantity ?? 0),
    minimo: Number(inv?.min_quantity ?? 0),
    maximo: Number(inv?.max_quantity ?? 0),
    reposicao: inv?.reorder_quantity != null ? Number(inv.reorder_quantity) : null,
    localizacao: inv?.location ?? null,
  };
}

export async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await (supabase as any)
    .from('parts')
    .select(SELECT_PRODUTO)
    .order('name')
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LinhaProduto[]).map(achatar);
}

export async function fetchProduto(id: string): Promise<Produto> {
  const { data, error } = await (supabase as any)
    .from('parts')
    .select(SELECT_PRODUTO)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return achatar(data as LinhaProduto);
}

/** Campos do cadastro. O saldo não está aqui de propósito. */
export type EdicaoProduto = {
  name: string;
  code: string | null;
  sku: string | null;
  brand: string | null;
  model: string | null;
  unit: string;
  cost_price: number | null;
  sale_price: number | null;
  supplier_id: string | null;
  active: boolean;
  minimo: number;
  maximo: number;
  reposicao: number | null;
  localizacao: string | null;
};

export async function salvarProduto(id: string, edicao: EdicaoProduto): Promise<void> {
  const { error: erroParte } = await (supabase as any)
    .from('parts')
    .update({
      name: edicao.name,
      code: edicao.code,
      sku: edicao.sku,
      brand: edicao.brand,
      model: edicao.model,
      unit: edicao.unit,
      cost_price: edicao.cost_price,
      sale_price: edicao.sale_price,
      supplier_id: edicao.supplier_id,
      active: edicao.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (erroParte) throw new Error(erroParte.message);

  // Parâmetros de reposição vivem no inventário, junto do saldo. O UPDATE
  // aqui não toca em `quantity` — saldo só muda por movimentação.
  const { error: erroInv } = await (supabase as any).from('inventory').upsert(
    {
      part_id: id,
      min_quantity: edicao.minimo,
      max_quantity: edicao.maximo,
      reorder_quantity: edicao.reposicao,
      location: edicao.localizacao,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'part_id' },
  );
  if (erroInv) throw new Error(erroInv.message);
}

export async function criarProduto(edicao: EdicaoProduto): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('parts')
    .insert({
      name: edicao.name,
      code: edicao.code,
      sku: edicao.sku,
      brand: edicao.brand,
      model: edicao.model,
      unit: edicao.unit,
      cost_price: edicao.cost_price,
      sale_price: edicao.sale_price,
      supplier_id: edicao.supplier_id,
      active: edicao.active,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const id = (data as { id: string }).id;
  const { error: erroInv } = await (supabase as any).from('inventory').upsert(
    {
      part_id: id,
      quantity: 0,
      min_quantity: edicao.minimo,
      max_quantity: edicao.maximo,
      reorder_quantity: edicao.reposicao,
      location: edicao.localizacao,
    },
    { onConflict: 'part_id' },
  );
  if (erroInv) throw new Error(erroInv.message);
  return id;
}

// ---------------------------------------------------------------------------
// Movimentação
// ---------------------------------------------------------------------------

export type TipoMovimento = 'entrada' | 'saida' | 'ajuste' | 'devolucao';

export async function movimentar(input: {
  partId: string;
  tipo: TipoMovimento;
  quantidade: number;
  motivo?: string | null;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('movimentar_estoque', {
    p_part_id: input.partId,
    p_tipo: input.tipo,
    p_quantidade: input.quantidade,
    p_motivo: input.motivo ?? null,
  });
  if (error) throw new Error(error.message);
}

export type Movimento = {
  id: string;
  type: string;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reason: string | null;
  note: string | null;
  created_at: string;
};

export async function fetchMovimentos(partId: string): Promise<Movimento[]> {
  const { data, error } = await (supabase as any)
    .from('inventory_movements')
    .select('id, type, quantity, quantity_before, quantity_after, reason, note, created_at')
    .eq('part_id', partId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Movimento[];
}

// ---------------------------------------------------------------------------
// Fornecedores
// ---------------------------------------------------------------------------

export type Fornecedor = {
  id: string;
  name: string;
  trade_name: string | null;
  doc: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  contact_name: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
};

export async function fetchFornecedores(): Promise<Fornecedor[]> {
  const { data, error } = await (supabase as any)
    .from('suppliers')
    .select('id, name, trade_name, doc, phone, whatsapp, email, contact_name, city, state, active')
    .eq('active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Fornecedor[];
}

export async function salvarFornecedor(
  id: string | null,
  dados: Omit<Fornecedor, 'id'>,
): Promise<string> {
  if (id) {
    const { error } = await (supabase as any)
      .from('suppliers')
      .update({ ...dados, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await (supabase as any)
    .from('suppliers')
    .insert(dados)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Solicitações de reposição
// ---------------------------------------------------------------------------

export type StatusReposicao =
  | 'rascunho'
  | 'pendente'
  | 'enviado_fornecedor'
  | 'fornecedor_respondeu'
  | 'em_analise'
  | 'aprovado'
  | 'comprado'
  | 'recebido'
  | 'concluido'
  | 'cancelado'
  | 'recusado';

export const ROTULO_STATUS: Record<StatusReposicao, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  enviado_fornecedor: 'Aguardando fornecedor',
  fornecedor_respondeu: 'Fornecedor respondeu',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  comprado: 'Pedido gerado',
  recebido: 'Recebido',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  recusado: 'Recusado',
};

export type Reposicao = {
  id: string;
  number: string;
  part_id: string;
  supplier_id: string | null;
  quantity_current: number;
  min_quantity: number;
  max_quantity: number;
  quantity_suggested: number;
  quantity_requested: number | null;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  status: StatusReposicao;
  notes: string | null;
  created_at: string;
  part: { name: string; unit: string; sku: string | null } | null;
  supplier: { name: string; whatsapp: string | null; email: string | null; contact_name: string | null } | null;
};

const SELECT_REPOSICAO = `
  id, number, part_id, supplier_id, quantity_current, min_quantity, max_quantity,
  quantity_suggested, quantity_requested, priority, status, notes, created_at,
  part:part_id ( name, unit, sku ),
  supplier:supplier_id ( name, whatsapp, email, contact_name )
`;

export async function fetchReposicoes(): Promise<Reposicao[]> {
  const { data, error } = await (supabase as any)
    .from('replenishment_requests')
    .select(SELECT_REPOSICAO)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Reposicao[];
}

export async function fetchReposicao(id: string): Promise<Reposicao> {
  const { data, error } = await (supabase as any)
    .from('replenishment_requests')
    .select(SELECT_REPOSICAO)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Reposicao;
}

/** O responsável pode mudar quantidade, fornecedor, prioridade e observação. */
export async function atualizarReposicao(
  id: string,
  patch: Partial<
    Pick<Reposicao, 'quantity_requested' | 'supplier_id' | 'priority' | 'status' | 'notes'>
  >,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('replenishment_requests')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Cria manualmente, quando o responsável não quer esperar a detecção. */
export async function criarReposicaoManual(partId: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('criar_solicitacao_reposicao', {
    p_part_id: partId,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/** Põe em dia os produtos que já estavam baixos antes do gatilho existir. */
export async function varrerEstoqueBaixo(): Promise<number> {
  const { data, error } = await (supabase as any).rpc('verificar_estoque_baixo');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ---------------------------------------------------------------------------
// Comunicação com o fornecedor
// ---------------------------------------------------------------------------

/** Texto da consulta de cotação, igual ao modelo aprovado. */
export function mensagemParaFornecedor(r: Reposicao): string {
  const quantidade = r.quantity_requested ?? r.quantity_suggested;
  const unidade = r.part?.unit ?? 'un';
  return [
    `Olá, ${r.supplier?.contact_name ?? r.supplier?.name ?? ''}.`.trim(),
    '',
    'Somos da JEmpreendimentos.',
    '',
    'Gostaríamos de consultar a disponibilidade e cotação do seguinte material:',
    '',
    `Produto: ${r.part?.name ?? ''}`,
    `Quantidade: ${quantidade} ${unidade}`,
    `Solicitação: ${r.number}`,
    '',
    'Por favor, informe:',
    '- disponibilidade;',
    '- valor unitário;',
    '- prazo de entrega;',
    '- condições de pagamento;',
    '- valor do frete.',
    '',
    'Obrigado.',
  ].join('\n');
}

/**
 * Registra o contato e devolve o link do WhatsApp.
 *
 * A ordem importa: grava primeiro, abre depois. A regra 2 diz que nenhuma
 * mensagem sai sem registro, e se o registro falhar o envio não acontece.
 */
export async function registrarEnvioWhatsapp(r: Reposicao): Promise<string> {
  const numero = (r.supplier?.whatsapp ?? '').replace(/\D/g, '');
  if (!numero) throw new Error('Este fornecedor não tem WhatsApp cadastrado.');

  const mensagem = mensagemParaFornecedor(r);
  const { data: auth } = await supabase.auth.getUser();

  const { error } = await (supabase as any).from('supplier_communications').insert({
    supplier_id: r.supplier_id,
    request_id: r.id,
    channel: 'whatsapp',
    recipient: numero,
    subject: `Solicitação de cotação — ${r.number}`,
    message: mensagem,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  await atualizarReposicao(r.id, { status: 'enviado_fornecedor' });

  const comDdi = numero.startsWith('55') ? numero : `55${numero}`;
  return `https://wa.me/${comDdi}?text=${encodeURIComponent(mensagem)}`;
}

export type Cotacao = {
  id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  shipping_cost: number;
  discount: number;
  total_value: number;
  payment_terms: string | null;
  delivery_days: number | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  supplier: { name: string } | null;
};

export async function fetchCotacoes(requestId: string): Promise<Cotacao[]> {
  const { data, error } = await (supabase as any)
    .from('supplier_quotes')
    .select(
      'id, supplier_id, quantity, unit_price, shipping_cost, discount, total_value, payment_terms, delivery_days, valid_until, notes, created_at, supplier:supplier_id ( name )',
    )
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Cotacao[];
}

export async function registrarCotacao(input: {
  requestId: string;
  supplierId: string;
  quantidade: number;
  valorUnitario: number;
  frete: number;
  desconto: number;
  prazoDias: number | null;
  pagamento: string | null;
  observacao: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('supplier_quotes').insert({
    request_id: input.requestId,
    supplier_id: input.supplierId,
    quantity: input.quantidade,
    unit_price: input.valorUnitario,
    shipping_cost: input.frete,
    discount: input.desconto,
    delivery_days: input.prazoDias,
    payment_terms: input.pagamento,
    notes: input.observacao,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  await atualizarReposicao(input.requestId, { status: 'fornecedor_respondeu' });
}

/** Aprova e gera o pedido de compra. A decisão é sempre de uma pessoa. */
export async function aprovarCompra(requestId: string, quoteId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('aprovar_reposicao', {
    p_request_id: requestId,
    p_quote_id: quoteId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
