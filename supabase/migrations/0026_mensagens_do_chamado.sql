-- ---------------------------------------------------------------------
-- 0026 — Mensagem no chamado avisa o outro lado
--
-- A tabela `service_call_messages` existe desde a 0001, e a 0022 já sabe
-- montar a notificação de 'MESSAGE_RECEIVED' — inclusive escolhendo para
-- quem ela vai: escreveu o cliente, avisa técnico e administração;
-- escreveu a equipe, avisa o cliente. Nunca de volta para quem escreveu.
--
-- Só que ninguém nunca chamou isso: não havia gatilho. Mensagem gravada
-- não avisava vivalma, e a conversa só seria vista por quem abrisse a
-- tela por acaso — que é o mesmo que não existir.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) O lado de quem escreveu, gravado na própria mensagem
--
-- A política de `profiles` só deixa a pessoa ler o próprio perfil (ou
-- tudo, se for administrador). Então o cliente não consegue descobrir
-- quem respondeu, e a tela dele não teria como distinguir a resposta da
-- equipe da própria fala.
--
-- Guardar o lado aqui resolve sem afrouxar nada: é calculado no servidor,
-- a partir do papel de verdade, e fica legível para quem já pode ler a
-- mensagem. Ninguém ganha acesso a perfil de ninguém.
-- ---------------------------------------------------------------------
alter table public.service_call_messages
  add column if not exists author_side text;

create or replace function public.tg_mensagem_chamado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_papel text;
begin
  select p.role::text into v_papel
    from public.profiles p
   where p.id = new.sender_id;

  -- Cliente é cliente; técnico e administração são a equipe, do ponto de
  -- vista de quem recebe.
  new.author_side := case when v_papel = 'cliente' then 'cliente' else 'equipe' end;

  perform public.notificar_evento(
    'MESSAGE_RECEIVED', 'chamado', new.service_call_id,
    jsonb_build_object('autor', new.author_side, 'mensagem_id', new.id));

  return new;
end;
$$;

drop trigger if exists service_call_messages_notifica on public.service_call_messages;
create trigger service_call_messages_notifica
  before insert on public.service_call_messages
  for each row execute function public.tg_mensagem_chamado();

-- Mensagens antigas, se houver, ficam identificadas pelo papel atual de
-- quem escreveu. É o melhor que dá para saber depois do fato.
update public.service_call_messages m
   set author_side = case when p.role::text = 'cliente' then 'cliente' else 'equipe' end
  from public.profiles p
 where p.id = m.sender_id
   and m.author_side is null;

-- A conversa precisa chegar sozinha na tela de quem está com ela aberta.
do $$ begin
  alter publication supabase_realtime add table public.service_call_messages;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 2) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from pg_trigger
    where tgname = 'service_call_messages_notifica' and not tgisinternal)  as gatilho_deve_ser_1,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'service_call_messages'
      and column_name = 'author_side')                                     as coluna_deve_ser_1,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'service_call_messages')                             as realtime_deve_ser_1,
  (select count(*) from public.service_call_messages
    where author_side is null)                                             as sem_lado_deve_ser_0;
