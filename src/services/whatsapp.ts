import { supabase } from '@/lib/supabase';

/**
 * Central de WhatsApp.
 *
 * As conversas e mensagens já têm tabela desde o schema inicial; quem ainda
 * não existe é o webhook da Business API que as alimenta. Enquanto ele não
 * entra, a tela mostra a lista vazia — e não dados de exemplo, que dariam a
 * impressão errada de que a integração está no ar.
 */

export type ConversaWhatsapp = {
  id: string;
  telefone: string;
  clienteId: string | null;
  clienteNome: string | null;
  /** Chamado já aberto a partir da conversa, se houver. */
  chamado: { id: string; code: number } | null;
  aberta: boolean;
  ultimaMensagemEm: string | null;
  ultimaMensagem: string | null;
  /** Última mensagem foi do cliente e ainda não teve resposta nossa. */
  aguardandoResposta: boolean;
};

export type ResumoWhatsapp = {
  aguardando: number;
  emTriagem: number;
  viraramChamado: number;
};

type ConversaRow = {
  id: string;
  phone: string;
  client_id: string | null;
  service_call_id: string | null;
  open: boolean;
  last_message_at: string | null;
  client: { name: string } | null;
  call: { id: string; code: number } | null;
};

type MensagemRow = {
  conversation_id: string;
  direction: 'entrada' | 'saida';
  body: string | null;
  created_at: string;
};

export async function fetchConversas(): Promise<ConversaWhatsapp[]> {
  const { data, error } = await (supabase as any)
    .from('whatsapp_conversations')
    .select(
      `id, phone, client_id, service_call_id, open, last_message_at,
       client:client_id ( name ),
       call:service_call_id ( id, code )`,
    )
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const conversas = (data ?? []) as ConversaRow[];
  if (conversas.length === 0) return [];

  // Uma consulta só para as últimas mensagens, em vez de uma por conversa.
  const { data: mensagens } = await (supabase as any)
    .from('whatsapp_messages')
    .select('conversation_id, direction, body, created_at')
    .in(
      'conversation_id',
      conversas.map((c) => c.id),
    )
    .order('created_at', { ascending: false })
    .limit(500);

  const ultimaPorConversa = new Map<string, MensagemRow>();
  for (const m of (mensagens ?? []) as MensagemRow[]) {
    if (!ultimaPorConversa.has(m.conversation_id)) ultimaPorConversa.set(m.conversation_id, m);
  }

  return conversas.map((c) => {
    const ultima = ultimaPorConversa.get(c.id);
    return {
      id: c.id,
      telefone: c.phone,
      clienteId: c.client_id,
      clienteNome: c.client?.name ?? null,
      chamado: c.call ?? null,
      aberta: c.open,
      ultimaMensagemEm: c.last_message_at ?? ultima?.created_at ?? null,
      ultimaMensagem: ultima?.body ?? null,
      aguardandoResposta: ultima?.direction === 'entrada',
    };
  });
}

export function resumirConversas(conversas: ConversaWhatsapp[]): ResumoWhatsapp {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return {
    aguardando: conversas.filter((c) => c.aberta && c.aguardandoResposta && !c.chamado).length,
    // "Em triagem": conversa aberta, já respondida, mas ainda sem chamado.
    emTriagem: conversas.filter((c) => c.aberta && !c.aguardandoResposta && !c.chamado).length,
    viraramChamado: conversas.filter(
      (c) => c.chamado && c.ultimaMensagemEm && new Date(c.ultimaMensagemEm) >= hoje,
    ).length,
  };
}

/** Iniciais para o avatar quadrado da lista. */
export function iniciaisDe(nome: string | null, telefone: string): string {
  if (!nome) return telefone.replace(/\D/g, '').slice(-2) || '?';
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** (11) 97788-2211 a partir de dígitos crus. */
export function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}
