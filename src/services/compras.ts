import { supabase } from '@/lib/supabase';

/**
 * Pedidos de compra e recebimento de mercadoria.
 *
 * O pedido nasce da aprovação de uma cotação (`aprovar_reposicao`, em
 * estoque.ts) e não tem itens próprios: a quantidade vem da cotação. Por
 * isso um pedido é sempre de um produto só.
 *
 * O saldo não se mexe quando o recebimento é registrado, e sim quando ele é
 * confirmado — é o gatilho `purchase_receipts_confirma` que dá a entrada.
 * Registrar sem confirmar existe para o caso comum de conferir a nota
 * depois que o material já foi descarregado.
 */

export type StatusPedido =
  | 'criado'
  | 'enviado'
  | 'confirmado'
  | 'em_transito'
  | 'recebido'
  | 'cancelado';

export const ROTULO_PEDIDO: Record<StatusPedido, string> = {
  criado: 'Criado',
  enviado: 'Enviado ao fornecedor',
  confirmado: 'Confirmado pelo fornecedor',
  em_transito: 'Em trânsito',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};

/** Status em que o pedido ainda espera mercadoria. */
export const PEDIDOS_ABERTOS: StatusPedido[] = [
  'criado',
  'enviado',
  'confirmado',
  'em_transito',
];

export type RecebimentoResumo = {
  id: string;
  quantity_received: number;
  quantity_ordered: number;
  confirmed: boolean;
};

export type Pedido = {
  id: string;
  number: string;
  status: StatusPedido;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  payment_terms: string | null;
  expected_delivery: string | null;
  created_at: string;
  supplier_id: string;
  request_id: string | null;
  quote_id: string | null;
  supplier: {
    name: string;
    whatsapp: string | null;
    email: string | null;
    contact_name: string | null;
  } | null;
  quote: { quantity: number; unit_price: number; delivery_days: number | null } | null;
  request: {
    id: string;
    number: string;
    part_id: string;
    part: { name: string; unit: string; sku: string | null } | null;
  } | null;
  recebimentos: RecebimentoResumo[];
};

const SELECT_PEDIDO = `
  id, number, status, subtotal, shipping, discount, total, payment_terms,
  expected_delivery, created_at, supplier_id, request_id, quote_id,
  supplier:supplier_id ( name, whatsapp, email, contact_name ),
  quote:quote_id ( quantity, unit_price, delivery_days ),
  request:request_id ( id, number, part_id, part:part_id ( name, unit, sku ) ),
  recebimentos:purchase_receipts ( id, quantity_received, quantity_ordered, confirmed )
`;

/**
 * Quanto o pedido pediu.
 *
 * Espelha `quantidade_do_pedido` no banco: a cotação manda, e um
 * recebimento antigo serve de última referência se a cotação foi apagada.
 */
export function quantidadePedida(p: Pedido): number {
  if (p.quote?.quantity) return Number(p.quote.quantity);
  const porRecebimento = p.recebimentos.map((r) => Number(r.quantity_ordered));
  return porRecebimento.length > 0 ? Math.max(...porRecebimento) : 0;
}

/** Só o que foi confirmado conta: o resto ainda não virou estoque. */
export function quantidadeRecebida(p: Pedido): number {
  return p.recebimentos
    .filter((r) => r.confirmed)
    .reduce((soma, r) => soma + Number(r.quantity_received), 0);
}

export function quantidadePendente(p: Pedido): number {
  return Math.max(0, quantidadePedida(p) - quantidadeRecebida(p));
}

export async function fetchPedidos(): Promise<Pedido[]> {
  const { data, error } = await (supabase as any)
    .from('purchase_orders')
    .select(SELECT_PEDIDO)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pedido[];
}

export async function fetchPedido(id: string): Promise<Pedido> {
  const { data, error } = await (supabase as any)
    .from('purchase_orders')
    .select(SELECT_PEDIDO)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data as Pedido;
}

/** O acompanhamento do pedido é manual: quem fala com o fornecedor marca. */
export async function atualizarStatusPedido(id: string, status: StatusPedido): Promise<void> {
  const { error } = await (supabase as any)
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Recebimentos
// ---------------------------------------------------------------------------

export type Recebimento = {
  id: string;
  purchase_order_id: string;
  part_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number | null;
  invoice_number: string | null;
  batch: string | null;
  expires_at: string | null;
  notes: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  created_at: string;
};

export async function fetchRecebimentos(pedidoId: string): Promise<Recebimento[]> {
  const { data, error } = await (supabase as any)
    .from('purchase_receipts')
    .select(
      'id, purchase_order_id, part_id, quantity_ordered, quantity_received, unit_price, invoice_number, batch, expires_at, notes, confirmed, confirmed_at, created_at',
    )
    .eq('purchase_order_id', pedidoId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Recebimento[];
}

export type EntradaRecebimento = {
  pedidoId: string;
  partId: string;
  quantidadePedida: number;
  quantidadeRecebida: number;
  valorUnitario: number | null;
  notaFiscal: string | null;
  lote: string | null;
  validade: string | null;
  observacao: string | null;
};

/**
 * Registra o recebimento. Confirmando, o gatilho do banco dá a entrada no
 * estoque e move o pedido — parcial vira 'em trânsito', completo vira
 * 'recebido'.
 */
export async function registrarRecebimento(
  entrada: EntradaRecebimento,
  confirmar: boolean,
): Promise<string> {
  const { data, error } = await (supabase as any)
    .from('purchase_receipts')
    .insert({
      purchase_order_id: entrada.pedidoId,
      part_id: entrada.partId,
      quantity_ordered: entrada.quantidadePedida,
      quantity_received: entrada.quantidadeRecebida,
      unit_price: entrada.valorUnitario,
      invoice_number: entrada.notaFiscal,
      batch: entrada.lote,
      expires_at: entrada.validade,
      notes: entrada.observacao,
      confirmed: confirmar,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Confirma uma conferência que ficou pendente. */
export async function confirmarRecebimento(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('purchase_receipts')
    .update({ confirmed: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Apaga um recebimento ainda não confirmado.
 *
 * Confirmado não se apaga: o saldo já mudou, e sumir com a linha deixaria
 * o movimento de entrada sem origem. Nesse caso o caminho é um ajuste.
 */
export async function excluirRecebimento(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('purchase_receipts')
    .delete()
    .eq('id', id)
    .eq('confirmed', false);
  if (error) throw new Error(error.message);
}
