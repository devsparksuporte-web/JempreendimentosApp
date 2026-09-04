-- ---------------------------------------------------------------------
-- 0035 — Por que o aviso do chamado novo não chega
--
-- O que se sabe até aqui, sem chutar:
--
--   * chamar `notificar_evento('NEW_TICKET', ...)` na mão FUNCIONA e cria
--     a notificação;
--   * o gatilho `service_calls_notifica_criacao` EXISTE (contagem = 1);
--   * existe 1 administrador e NEW_TICKET é crítico;
--   * e mesmo assim os chamados criados pelo aplicativo não geraram aviso
--     NEM distribuição automática.
--
-- Duas coisas independentes falharem juntas, nas mesmas inserções, com a
-- função que as duas chamam funcionando quando chamada à mão, aponta para
-- uma causa única: os gatilhos AFTER INSERT de `service_calls` não estão
-- rodando. Existir e estar habilitado são coisas diferentes — `pg_trigger`
-- conta o que existe; quem manda é a coluna `tgenabled`, e um
-- `session_replication_role = replica` no banco ou no papel desliga todos
-- de uma vez sem apagar nenhum.
--
-- Esta migração não adivinha: primeiro mede (seção 1), depois conserta o
-- que é seguro consertar (seção 2).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) O diagnóstico
--
-- `select * from public.diagnostico_de_notificacao();` — sem argumento
-- olha o último chamado; com um número, olha aquele chamado.
-- ---------------------------------------------------------------------
create or replace function public.diagnostico_de_notificacao(p_code integer default null)
returns table (item text, resultado text, observacao text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_call public.service_calls%rowtype;
begin
  -- ---- Ambiente -----------------------------------------------------
  return query
  select 'session_replication_role',
         current_setting('session_replication_role'),
         case current_setting('session_replication_role')
           when 'replica' then 'CAUSA PROVÁVEL: em "replica" nenhum gatilho comum dispara.'
           else 'Normal.'
         end;

  return query
  select 'ajuste fixo de session_replication_role',
         coalesce(string_agg(s.setconfig::text, ' | '), 'nenhum'),
         'Ajuste gravado no banco ou no papel; sobrevive a reconexão.'
    from pg_db_role_setting s
   where s.setconfig::text like '%session_replication_role%';

  -- ---- Gatilhos de service_calls -------------------------------------
  return query
  select 'gatilho ' || t.tgname,
         case t.tgenabled
           when 'O' then 'habilitado (origem)'
           when 'D' then 'DESABILITADO'
           when 'A' then 'habilitado sempre'
           when 'R' then 'habilitado só em réplica'
         end,
         case when t.tgenabled = 'D' then 'CAUSA: gatilho desligado, não dispara.' else '' end
    from pg_trigger t
   where t.tgrelid = 'public.service_calls'::regclass
     and not t.tgisinternal
   order by 1;

  -- ---- Gatilho de push ----------------------------------------------
  return query
  select 'gatilho ' || t.tgname,
         case t.tgenabled when 'D' then 'DESABILITADO' when 'A' then 'habilitado sempre' else 'habilitado' end,
         'Envio do push para a Expo.'
    from pg_trigger t
   where t.tgrelid = 'public.notifications'::regclass
     and not t.tgisinternal;

  -- ---- Tempo real -----------------------------------------------------
  return query
  select 'notifications no realtime',
         case when exists (
           select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
         ) then 'sim' else 'NÃO' end,
         'Sem isso o aplicativo aberto não recebe o INSERT.';

  -- ---- pg_net ---------------------------------------------------------
  return query
  select 'net.http_post existe',
         case when to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null
              then 'sim' else 'NÃO' end,
         'Função que dispara o push.';

  -- ---- Destinatários --------------------------------------------------
  return query
  select 'administradores', count(*)::text, 'Quem recebe NEW_TICKET.'
    from public.profiles where role = 'admin';

  return query
  select 'aparelhos com push', count(*)::text, 'Registros em push_tokens.'
    from public.push_tokens;

  -- ---- O chamado ------------------------------------------------------
  if p_code is null then
    select * into v_call from public.service_calls order by created_at desc limit 1;
  else
    select * into v_call from public.service_calls where code = p_code;
  end if;

  if not found then
    return query select 'chamado', 'nenhum', 'Sem chamado para conferir.';
    return;
  end if;

  return query select 'chamado analisado', '#' || v_call.code,
    'criado em ' || to_char(v_call.created_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  return query
  select 'avisos gerados para ele', count(*)::text,
         case when count(*) = 0
              then 'ZERO: o gatilho não rodou ou abortou antes de gravar.'
              else 'Gravados na tabela notifications.' end
    from public.notifications
   where entity_type = 'chamado' and entity_id = v_call.id;

  return query
  select 'push do aviso',
         coalesce(n.push_error, case when n.push_sent then 'enviado (pedido ' || n.push_request_id || ')' else 'não enviado' end),
         'Erro gravado pela 0028, quando houve.'
    from public.notifications n
   where n.entity_type = 'chamado' and n.entity_id = v_call.id
   order by n.created_at desc
   limit 3;

  return query
  select 'distribuição automática', count(*)::text, 'Execuções registradas para o chamado.'
    from public.service_distribution_runs
   where service_call_id = v_call.id;

  -- ---- Falhas engolidas ----------------------------------------------
  return query
  select 'falha registrada: ' || f.gatilho,
         f.erro,
         to_char(f.quando at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || coalesce(' — ' || f.detalhe, '')
    from public.falhas_de_gatilho f
   order by f.quando desc
   limit 10;
end;
$$;

revoke all on function public.diagnostico_de_notificacao(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) O conserto seguro
--
-- `enable always` em vez de `enable`: o gatilho passa a disparar mesmo
-- com `session_replication_role = replica`. É deliberado. Avisar o
-- cliente de que o chamado dele entrou não é detalhe de replicação, e
-- este banco não tem consumidor de replicação lógica que fosse duplicar
-- o efeito. Rodar isto quando o gatilho já está normal não muda nada.
-- ---------------------------------------------------------------------
do $$
declare
  v_alvo record;
begin
  for v_alvo in
    select * from (values
      ('public.service_calls',  'service_calls_notifica_criacao'),
      ('public.service_calls',  'service_calls_notifica_atualizacao'),
      ('public.service_calls',  'service_calls_auto_distribute'),
      ('public.service_calls',  'service_calls_auto_assign'),
      ('public.notifications',  'notifications_push')
    ) as t(tabela, gatilho)
  loop
    if exists (
      select 1 from pg_trigger
       where tgrelid = v_alvo.tabela::regclass
         and tgname = v_alvo.gatilho
         and not tgisinternal
    ) then
      execute format('alter table %s enable always trigger %I', v_alvo.tabela, v_alvo.gatilho);
      raise notice 'Gatilho % religado em modo sempre.', v_alvo.gatilho;
    else
      raise notice 'Gatilho % não existe nesta base.', v_alvo.gatilho;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) Conferência
--
--   select * from public.diagnostico_de_notificacao();
--
-- Abra um chamado pelo aplicativo e rode de novo. "avisos gerados para
-- ele" precisa sair de 0.
-- ---------------------------------------------------------------------
