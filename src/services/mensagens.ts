import { supabase } from '@/lib/supabase';

/**
 * Conversa dentro do chamado.
 *
 * A RLS resolve quem vê o quê: `sc_messages_read` usa `can_see_call`, então
 * cliente, técnico designado e administração enxergam a mesma conversa, e
 * mais ninguém. Não há o que filtrar aqui.
 *
 * Nomes de autor não são buscados de propósito. A política de `profiles`
 * só deixa a pessoa ler o próprio perfil (ou tudo, se for administrador) —
 * um cliente que tentasse ler o perfil do técnico receberia vazio. Por
 * isso o lado de quem escreveu vem gravado na própria mensagem, em
 * `author_side`, calculado pelo gatilho da 0026.
 */

export type Mensagem = {
  id: string;
  service_call_id: string;
  sender_id: string | null;
  body: string;
  author_side: 'cliente' | 'equipe' | null;
  created_at: string;
};

export async function fetchMensagens(callId: string): Promise<Mensagem[]> {
  const { data, error } = await (supabase as any)
    .from('service_call_messages')
    .select('id, service_call_id, sender_id, body, author_side, created_at')
    .eq('service_call_id', callId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as Mensagem[];
}

/**
 * Envia a mensagem.
 *
 * `sender_id` vai explícito porque a RLS de inserção exige
 * `sender_id = auth.uid()` — é o que impede alguém de escrever no nome de
 * outra pessoa.
 */
export async function enviarMensagem(callId: string, texto: string): Promise<Mensagem> {
  const corpo = texto.trim();
  if (!corpo) throw new Error('Mensagem vazia.');

  const { data: auth } = await supabase.auth.getUser();
  const eu = auth.user?.id;
  if (!eu) throw new Error('Sessão expirada. Entre de novo.');

  const { data, error } = await (supabase as any)
    .from('service_call_messages')
    .insert({ service_call_id: callId, sender_id: eu, body: corpo })
    .select('id, service_call_id, sender_id, body, author_side, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as Mensagem;
}

/** Sequência das inscrições. Ver `assinarMensagens`. */
let sequenciaDeCanal = 0;

/**
 * Escuta as mensagens que chegam neste chamado.
 *
 * O nome do canal é único a cada chamada pelo mesmo motivo das
 * notificações: o supabase-js devolve o canal já existente quando alguém
 * pede um tópico repetido, e como `removeChannel` é assíncrono, sair da
 * tela e voltar pegaria o canal anterior — já inscrito — e o `.on()`
 * estouraria em "cannot add postgres_changes callbacks after subscribe()".
 */
export function assinarMensagens(callId: string, aoChegar: (m: Mensagem) => void) {
  sequenciaDeCanal += 1;
  const canal = supabase
    .channel(`mensagens:${callId}:${sequenciaDeCanal}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'service_call_messages',
        filter: `service_call_id=eq.${callId}`,
      },
      (payload) => {
        aoChegar(payload.new as Mensagem);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
