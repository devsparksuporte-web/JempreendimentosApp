-- ---------------------------------------------------------------------
-- 0037 — Endereço de entrega morto para de acumular
--
-- O que aconteceu, e vai voltar a acontecer com mais gente:
--
--   1. o aparelho registra um token;
--   2. o APK é reinstalado, e o FCM invalida aquele token;
--   3. a nova instalação registra OUTRO token;
--   4. o antigo fica na tabela para sempre.
--
-- O envio não enxerga isso: `push_sent = true` significa apenas que a Expo
-- ACEITOU o pedido. O "DeviceNotRegistered" só aparece no recibo, que é uma
-- segunda consulta que ninguém fazia. Resultado: dois diagnósticos inteiros
-- para descobrir que o endereço estava morto.
--
-- Com um administrador e um tablet isso era chato. Com uma equipe de
-- técnicos, cada um com celular próprio e cada troca de APK deixando um
-- fantasma, vira ruído permanente — e a Expo penaliza quem envia demais
-- para endereço inválido, atrasando os avisos que importam.
--
-- A limpeza não precisa de agendador nem de segunda chamada HTTP. O
-- aplicativo atualiza `updated_at` a cada abertura, então token que não é
-- confirmado há 60 dias está morto por definição: ou o aparelho sumiu, ou
-- a instalação foi trocada, ou a pessoa parou de usar. Em qualquer um dos
-- três casos não há o que entregar ali.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) A limpeza, disponível também para rodar à mão
-- ---------------------------------------------------------------------
create or replace function public.limpar_push_tokens_parados(p_dias integer default 60)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_apagados integer;
begin
  if p_dias < 7 then
    raise exception 'Prazo curto demais: apagaria aparelho de quem só ficou uns dias sem abrir.';
  end if;

  delete from public.push_tokens
   where updated_at < now() - make_interval(days => p_dias);

  get diagnostics v_apagados = row_count;
  return v_apagados;
end;
$$;

comment on function public.limpar_push_tokens_parados(integer) is
  'Apaga endereços de push não confirmados no prazo. O app confirma o dele a cada abertura.';

-- ---------------------------------------------------------------------
-- 2) O envio limpa o que é dele antes de enviar
--
-- Só os tokens DO PERFIL que está recebendo, e no momento em que a lista
-- dele é montada. É o instante em que a informação importa, custa uma
-- linha e dispensa pg_cron — que seria mais uma peça para configurar,
-- monitorar e esquecer.
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
  -- Endereço não confirmado há 60 dias não recebe mais nada. Apagar aqui
  -- evita que a lista de envio cresça com fantasmas a cada troca de APK.
  delete from public.push_tokens
   where profile_id = new.profile_id
     and updated_at < now() - interval '60 days';

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
  -- o navegador, e com quem ainda não abriu o aplicativo depois de entrar
  -- na conta. Não é erro — mas agora fica dito no registro, porque
  -- "push_sent = false" sem motivo já custou duas rodadas de diagnóstico.
  if v_mensagens is null then
    update public.notifications
       set push_error = 'sem aparelho registrado para este perfil'
     where id = new.id;
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

alter table public.notifications enable always trigger notifications_push;

-- ---------------------------------------------------------------------
-- 3) Quem pode chamar a limpeza à mão
-- ---------------------------------------------------------------------
revoke all on function public.limpar_push_tokens_parados(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Conferência
--
--   select p.full_name, p.role, count(*) as aparelhos,
--          max(t.updated_at) as ultima_confirmacao
--     from public.push_tokens t
--     join public.profiles p on p.id = t.profile_id
--    group by p.full_name, p.role
--    order by 3 desc;
--
-- Aparelho com `ultima_confirmacao` antiga é candidato a fantasma. Para
-- apagar agora, sem esperar os 60 dias:
--
--   select public.limpar_push_tokens_parados(7);
-- ---------------------------------------------------------------------
