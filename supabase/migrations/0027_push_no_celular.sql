-- ---------------------------------------------------------------------
-- 0027 — Aviso que chega com o aplicativo fechado
--
-- Desde a 0022 o sistema grava notificação com destino certo, categoria e
-- prioridade — e a tabela até tem uma coluna `push_sent` que nunca foi
-- escrita por ninguém. O aviso só aparecia para quem estivesse com o
-- aplicativo aberto na hora, o que exclui justamente o caso que importa:
-- chamado urgente entrando enquanto o celular está no bolso.
--
-- O envio sai do próprio banco, por pg_net, direto para o serviço de push
-- da Expo. Não há chave secreta envolvida: o endereço de entrega é o
-- token do aparelho, que só o próprio aparelho consegue gerar.
-- ---------------------------------------------------------------------

do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  -- Em projeto onde a extensão já veio habilitada, seguir em frente.
  raise notice 'pg_net: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- 1) Onde entregar
--
-- Um perfil pode ter vários aparelhos — o técnico com celular e tablet
-- recebe nos dois. A chave é o token, não o perfil.
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  token       text primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_profile_idx on public.push_tokens (profile_id);

alter table public.push_tokens enable row level security;

-- Cada um cuida dos próprios aparelhos. Ninguém lê o token de ninguém:
-- token de push é endereço de entrega, e endereço alheio não se lê.
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) O envio
--
-- Roda depois do insert da notificação, que já passou pelo filtro de
-- preferências da 0022 — se a linha existe, é porque a pessoa quer
-- receber.
--
-- pg_net enfileira a chamada e responde na hora: falha de entrega não
-- derruba a transação que originou o aviso. Um chamado não pode deixar de
-- ser criado porque o servidor de push estava fora do ar.
-- ---------------------------------------------------------------------
create or replace function public.tg_enviar_push()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_mensagens jsonb;
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

  perform extensions.net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_mensagens,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'));

  update public.notifications set push_sent = true where id = new.id;
  return new;
exception when others then
  -- Aviso não entregue é ruim; chamado não criado é pior.
  raise notice 'push falhou para % : %', new.id, sqlerrm;
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
-- Para investigar entrega depois, a resposta de cada chamada fica em
-- `net._http_response`, com o corpo devolvido pela Expo.
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'push_tokens')        as tabela_deve_ser_1,
  (select count(*) from pg_trigger
    where tgname = 'notifications_push' and not tgisinternal)            as gatilho_deve_ser_1,
  (select count(*) from pg_extension where extname = 'pg_net')           as pg_net_deve_ser_1;
