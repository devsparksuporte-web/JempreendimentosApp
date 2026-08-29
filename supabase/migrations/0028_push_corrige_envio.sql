-- ---------------------------------------------------------------------
-- 0028 — O aviso volta a sair do banco
--
-- A 0027 chamava `extensions.net.http_post`. Nome de três partes, no
-- Postgres, é banco.esquema.função — então aquilo nunca resolveu para a
-- função do pg_net, que é `net.http_post` e ponto. Toda chamada levantava
-- exceção.
--
-- E ninguém percebeu porque o `exception when others` só dava `raise
-- notice`: a notificação continuava sendo gravada, o sino continuava
-- acendendo, e o celular ficava mudo sem nenhum rastro. Falha silenciosa
-- é pior que falha barulhenta — o conserto aqui é tanto a chamada certa
-- quanto deixar o motivo registrado onde dê para ler depois.
-- ---------------------------------------------------------------------

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- 1) Onde fica o rastro
--
-- `push_sent` só dizia "deu certo". Não dizia o contrário. Estas duas
-- colunas guardam o porquê da falha e o número do pedido no pg_net, que é
-- a chave para achar a resposta da Expo em `net._http_response`.
-- ---------------------------------------------------------------------
alter table public.notifications
  add column if not exists push_error      text,
  add column if not exists push_request_id bigint;

-- ---------------------------------------------------------------------
-- 2) O envio
-- ---------------------------------------------------------------------
create or replace function public.tg_enviar_push()
returns trigger
language plpgsql
security definer set search_path = public, net, extensions
as $$
declare
  v_mensagens jsonb;
  v_pedido    bigint;
begin
  select jsonb_agg(
           jsonb_build_object(
             'to', t.token,
             'title', new.title,
             'body', coalesce(new.body, ''),
             'sound', 'default',
             -- Urgente acorda a tela; o resto espera a pessoa olhar.
             'priority', case when new.priority in ('urgent', 'high') then 'high' else 'normal' end,
             'channelId', 'default',
             'data', jsonb_build_object(
               'notificacao_id', new.id,
               'entity_type', new.entity_type,
               'entity_id', new.entity_id,
               'categoria', new.categoria)))
    into v_mensagens
    from public.push_tokens t
   where t.profile_id = new.profile_id;

  -- Sem aparelho registrado não há o que enviar. Acontece com quem só usa
  -- o navegador, e não é erro.
  if v_mensagens is null then
    return new;
  end if;

  v_pedido := net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := v_mensagens,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'));

  update public.notifications
     set push_sent = true, push_request_id = v_pedido, push_error = null
   where id = new.id;
  return new;
exception when others then
  -- Aviso não entregue é ruim; chamado não criado é pior. A transação
  -- segue, mas agora o motivo fica gravado em vez de se perder num notice.
  begin
    update public.notifications set push_error = sqlerrm where id = new.id;
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.tg_enviar_push();

-- ---------------------------------------------------------------------
-- 3) Conferência
--
-- Deve devolver 1 na extensão e a função `net.http_post` existindo.
-- ---------------------------------------------------------------------
select
  (select count(*) from pg_extension where extname = 'pg_net')          as pg_net_deve_ser_1,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'net' and p.proname = 'http_post')                as http_post_maior_que_0,
  (select count(*) from pg_trigger
    where tgname = 'notifications_push' and not tgisinternal)           as gatilho_deve_ser_1;
