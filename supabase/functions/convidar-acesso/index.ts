import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Convite de acesso por email.
 *
 * Criar uma conta exige a chave de serviço do Supabase, que tem poder total
 * sobre o banco e ignora toda a RLS. Ela não pode entrar no aplicativo: o
 * bundle de um APK é um arquivo zip que qualquer pessoa abre. Por isso o
 * convite mora aqui, num servidor onde a chave vive numa variável de
 * ambiente e nunca é enviada a ninguém.
 *
 * Quem convida é conferido AQUI, contra o banco — não no aplicativo. Uma
 * verificação de papel feita na tela protege a tela, não a API: qualquer
 * pessoa com a chave anônima pode chamar esta função direto pelo terminal.
 *
 * A pessoa convidada nasce como cliente, porque é o que o gatilho
 * `handle_new_user` faz com todo cadastro novo — de propósito, para que
 * ninguém se promova sozinho. Virar técnico continua sendo ato do
 * administrador, na tela de Equipe técnica.
 */

const CABECALHOS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: CABECALHOS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CABECALHOS });
  }
  if (req.method !== 'POST') {
    return responder({ erro: 'Método não permitido.' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !servico) {
    return responder({ erro: 'Função mal configurada no servidor.' }, 500);
  }

  const credencial = req.headers.get('Authorization') ?? '';
  if (!credencial.toLowerCase().startsWith('bearer ')) {
    return responder({ erro: 'Faça login antes de convidar.' }, 401);
  }

  // Cliente com a credencial de quem chamou: serve para descobrir quem é a
  // pessoa e para ler o perfil dela sob as mesmas regras de sempre.
  const comoChamador = createClient(url, anon, {
    global: { headers: { Authorization: credencial } },
    auth: { persistSession: false },
  });

  const { data: sessao, error: falhaSessao } = await comoChamador.auth.getUser();
  if (falhaSessao || !sessao?.user) {
    return responder({ erro: 'Sessão inválida ou expirada.' }, 401);
  }

  const { data: perfil } = await comoChamador
    .from('profiles')
    .select('role')
    .eq('id', sessao.user.id)
    .single();

  if (perfil?.role !== 'admin') {
    return responder({ erro: 'Somente administradores podem convidar.' }, 403);
  }

  let corpo: { email?: string; nome?: string; redirectTo?: string };
  try {
    corpo = await req.json();
  } catch {
    return responder({ erro: 'Corpo da requisição inválido.' }, 400);
  }

  const email = (corpo.email ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return responder({ erro: 'Informe um email válido.' }, 400);
  }

  const nome = (corpo.nome ?? '').trim();

  const comoServico = createClient(url, servico, { auth: { persistSession: false } });

  const { data, error } = await comoServico.auth.admin.inviteUserByEmail(email, {
    data: nome ? { full_name: nome } : undefined,
    redirectTo: corpo.redirectTo,
  });

  if (error) {
    // A mensagem crua do Supabase é em inglês e às vezes técnica demais para
    // aparecer na tela de quem só quis convidar um colega.
    const cru = error.message.toLowerCase();
    if (cru.includes('already been registered') || cru.includes('already exists')) {
      return responder({ erro: 'Esse email já tem conta. Vincule pela tela de equipe.' }, 409);
    }
    if (cru.includes('rate limit') || cru.includes('too many')) {
      return responder({ erro: 'Muitos convites seguidos. Espere alguns minutos.' }, 429);
    }
    return responder({ erro: error.message }, 400);
  }

  return responder({
    ok: true,
    convidado: { id: data.user?.id ?? null, email },
  });
});
