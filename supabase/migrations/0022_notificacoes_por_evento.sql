-- =====================================================================
-- JEmpreendimentos — Notificações por evento
--
-- A tabela `notifications` existia desde o início, mas ninguém escrevia
-- nela: não havia uma única inserção em todo o schema. A central do app
-- lia uma tabela que nunca enchia.
--
-- Aqui entra o motor. A decisão de fundo é que o evento nasce no BANCO, por
-- gatilho, e não no aplicativo. Assim a notificação acontece mesmo quando
-- quem provocou o evento estava com o app fechado, ou quando a mudança veio
-- de outro cliente, do SQL Editor ou de uma automação futura.
--
-- O caminho é sempre o mesmo:
--
--   evento -> notificar_evento() -> resolve destinatários -> notificar()
--   -> insert em notifications -> Supabase Realtime -> app
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Vocabulário
-- ---------------------------------------------------------------------
do $$ begin
  create type public.notification_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

alter table public.notifications
  add column if not exists tipo        text,
  add column if not exists categoria   text,
  add column if not exists entity_type text,
  add column if not exists entity_id   uuid,
  add column if not exists priority    public.notification_priority not null default 'normal',
  add column if not exists push_sent   boolean not null default false,
  add column if not exists metadata    jsonb not null default '{}';

comment on column public.notifications.tipo is
  'Evento que originou a notificação (NEW_TICKET, STOCK_LOW, ...).';
comment on column public.notifications.categoria is
  'Agrupador para os filtros da central e para as preferências do usuário.';

create index if not exists notifications_entidade_idx
  on public.notifications (entity_type, entity_id);
create index if not exists notifications_categoria_idx
  on public.notifications (profile_id, categoria, created_at desc);

-- ---------------------------------------------------------------------
-- 2) Catálogo de eventos
--
-- Fica em TABELA, não em CASE dentro da função: acrescentar um evento novo
-- passa a ser um INSERT, sem reescrever lógica. É o que a especificação pede
-- ao falar em arquitetura modular.
-- ---------------------------------------------------------------------
create table if not exists public.notification_events (
  evento      text primary key,
  categoria   text not null,
  priority    public.notification_priority not null default 'normal',
  -- Notificação crítica ignora preferência do usuário: desligar não pode
  -- fazer alguém perder o chamado que precisa atender.
  critico     boolean not null default false,
  descricao   text
);

insert into public.notification_events (evento, categoria, priority, critico, descricao) values
  ('NEW_TICKET',             'chamados',   'high',   true,  'Cliente abriu um chamado'),
  ('TICKET_ASSIGNED',        'chamados',   'high',   true,  'Chamado atribuído a um técnico'),
  ('TICKET_ACCEPTED',        'chamados',   'normal', false, 'Técnico aceitou o atendimento'),
  ('TICKET_EN_ROUTE',        'chamados',   'high',   true,  'Técnico iniciou o deslocamento'),
  ('TICKET_STARTED',         'chamados',   'high',   true,  'Atendimento iniciado'),
  ('TICKET_FINISHED',        'chamados',   'high',   true,  'Atendimento finalizado'),
  ('TICKET_CANCELLED',       'chamados',   'high',   true,  'Chamado cancelado'),
  ('TICKET_WAITING_PART',    'chamados',   'normal', false, 'Atendimento aguardando peça'),
  ('TICKET_WAITING_APPROVAL','chamados',   'high',   false, 'Atendimento aguardando aprovação'),
  ('TICKET_URGENT',          'chamados',   'urgent', true,  'Chamado aberto como urgente'),
  ('TICKET_RATED',           'servicos',   'normal', false, 'Cliente avaliou o atendimento'),
  ('MESSAGE_RECEIVED',       'mensagens',  'high',   false, 'Nova mensagem no chamado'),
  ('STOCK_LOW',              'estoque',    'normal', false, 'Item abaixo do estoque mínimo'),
  ('STOCK_ENTRY',            'estoque',    'low',    false, 'Entrada de material'),
  ('STOCK_EXIT',             'estoque',    'low',    false, 'Saída de material'),
  ('QUOTE_CREATED',          'financeiro', 'normal', false, 'Orçamento criado'),
  ('QUOTE_APPROVED',         'financeiro', 'high',   false, 'Orçamento aprovado'),
  ('QUOTE_REJECTED',         'financeiro', 'normal', false, 'Orçamento recusado'),
  ('PAYMENT_PENDING',        'financeiro', 'normal', false, 'Pagamento pendente'),
  ('PAYMENT_CONFIRMED',      'financeiro', 'normal', false, 'Pagamento confirmado'),
  ('SCHEDULE_CREATED',       'agenda',     'normal', false, 'Agendamento criado'),
  ('SCHEDULE_CHANGED',       'agenda',     'high',   false, 'Agendamento alterado'),
  ('SCHEDULE_CANCELLED',     'agenda',     'high',   false, 'Agendamento cancelado'),
  ('TECHNICIAN_AVAILABLE',   'equipe',     'low',    false, 'Técnico ficou disponível'),
  ('TECHNICIAN_UNAVAILABLE', 'equipe',     'low',    false, 'Técnico ficou indisponível')
on conflict (evento) do update
  set categoria = excluded.categoria,
      priority  = excluded.priority,
      critico   = excluded.critico,
      descricao = excluded.descricao;

-- ---------------------------------------------------------------------
-- 3) Preferências por categoria
-- ---------------------------------------------------------------------
create table if not exists public.notification_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  categoria  text not null,
  habilitado boolean not null default true,
  primary key (profile_id, categoria)
);

-- ---------------------------------------------------------------------
-- 4) Quem são os administradores
-- ---------------------------------------------------------------------
create or replace function public.perfis_admin()
returns setof uuid
language sql
stable
security definer set search_path = public
as $$
  select id from public.profiles where role = 'admin' and active;
$$;

-- ---------------------------------------------------------------------
-- 5) Criação de uma notificação
--
-- security definer porque quem dispara o gatilho é o cliente ou o técnico,
-- e nenhum dos dois tem permissão para escrever na caixa de outra pessoa.
-- ---------------------------------------------------------------------
create or replace function public.notificar(
  p_profile     uuid,
  p_evento      text,
  p_titulo      text,
  p_corpo       text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_cat      text;
  v_prio     public.notification_priority;
  v_critico  boolean;
  v_ligado   boolean;
begin
  if p_profile is null then
    return;
  end if;

  select categoria, priority, critico
    into v_cat, v_prio, v_critico
    from public.notification_events
   where evento = p_evento;

  -- Evento fora do catálogo ainda notifica, com prioridade comum. Melhor uma
  -- notificação sem classificação do que um evento que some em silêncio.
  v_cat     := coalesce(v_cat, 'geral');
  v_prio    := coalesce(v_prio, 'normal');
  v_critico := coalesce(v_critico, false);

  if not v_critico then
    select habilitado into v_ligado
      from public.notification_preferences
     where profile_id = p_profile and categoria = v_cat;
    if v_ligado is false then
      return;
    end if;
  end if;

  insert into public.notifications
    (profile_id, title, body, kind, tipo, categoria, entity_type, entity_id, priority, metadata)
  values
    (p_profile, p_titulo, p_corpo,
     case v_prio when 'urgent' then 'danger' when 'high' then 'warning' else 'info' end,
     p_evento, v_cat, p_entity_type, p_entity_id, v_prio, coalesce(p_metadata, '{}'));
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Resolução de destinatários — o notifyByEvent da especificação
--
-- Uma única porta de entrada. Quem chama diz o que aconteceu; quem recebe é
-- decidido aqui, e em lugar nenhum mais.
-- ---------------------------------------------------------------------
create or replace function public.notificar_evento(
  p_evento      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_metadata    jsonb default '{}'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_call        public.service_calls%rowtype;
  v_cliente     uuid;
  v_tecnico     uuid;
  v_nome_cli    text;
  v_nome_tec    text;
  v_admin       uuid;
  v_titulo      text;
  v_corpo       text;
begin
  -- Contexto do chamado, quando o evento gira em torno de um.
  if p_entity_type = 'chamado' then
    select * into v_call from public.service_calls where id = p_entity_id;
    if not found then
      return;
    end if;

    select c.profile_id, c.name into v_cliente, v_nome_cli
      from public.clients c where c.id = v_call.client_id;

    if v_call.technician_id is not null then
      select t.profile_id, p.full_name into v_tecnico, v_nome_tec
        from public.technicians t
        join public.profiles p on p.id = t.profile_id
       where t.id = v_call.technician_id;
    end if;
  end if;

  -- -------------------------------------------------------------------
  -- Chamados
  -- -------------------------------------------------------------------
  if p_evento in ('NEW_TICKET', 'TICKET_URGENT') then
    v_titulo := case when p_evento = 'TICKET_URGENT' then 'Chamado urgente' else 'Novo chamado' end;
    v_corpo  := coalesce(v_nome_cli, 'Um cliente') || ' abriu o chamado #' || v_call.code || ': ' || v_call.title || '.';
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo, v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;
    -- O cliente recebe a confirmação de que o chamado entrou.
    perform public.notificar(v_cliente, p_evento, 'Chamado aberto',
      'Seu chamado #' || v_call.code || ' foi registrado com sucesso.', 'chamado', v_call.id, p_metadata);

  elsif p_evento = 'TICKET_ASSIGNED' then
    perform public.notificar(v_tecnico, p_evento, 'Novo atendimento',
      'Você recebeu o chamado #' || v_call.code || ' de ' || coalesce(v_nome_cli, 'um cliente') || '.',
      'chamado', v_call.id, p_metadata);
    perform public.notificar(v_cliente, p_evento, 'Técnico designado',
      'O técnico ' || coalesce(v_nome_tec, 'responsável') || ' foi designado para seu atendimento.',
      'chamado', v_call.id, p_metadata);

  elsif p_evento = 'TICKET_ACCEPTED' then
    v_corpo := coalesce(v_nome_tec, 'O técnico') || ' aceitou o chamado #' || v_call.code || '.';
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Técnico aceitou', v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_EN_ROUTE' then
    perform public.notificar(v_cliente, p_evento, 'Técnico a caminho',
      'O técnico ' || coalesce(v_nome_tec, 'responsável') || ' iniciou o deslocamento até seu endereço.',
      'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Deslocamento iniciado',
        coalesce(v_nome_tec, 'O técnico') || ' saiu para o chamado #' || v_call.code || '.',
        'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_STARTED' then
    perform public.notificar(v_cliente, p_evento, 'Atendimento iniciado',
      'O técnico iniciou o atendimento.', 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Atendimento iniciado',
        'Chamado #' || v_call.code || ' em execução.', 'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_FINISHED' then
    perform public.notificar(v_cliente, p_evento, 'Serviço concluído',
      'Seu atendimento foi finalizado.', 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Atendimento finalizado',
        'Chamado #' || v_call.code || ' concluído por ' || coalesce(v_nome_tec, 'técnico') || '.',
        'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_CANCELLED' then
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Chamado cancelado',
        'O chamado #' || v_call.code || ' foi cancelado.', 'chamado', v_call.id, p_metadata);
    end loop;
    perform public.notificar(v_tecnico, p_evento, 'Atendimento cancelado',
      'O chamado #' || v_call.code || ' foi cancelado.', 'chamado', v_call.id, p_metadata);
    perform public.notificar(v_cliente, p_evento, 'Chamado cancelado',
      'Seu chamado #' || v_call.code || ' foi cancelado.', 'chamado', v_call.id, p_metadata);

  elsif p_evento in ('TICKET_WAITING_PART', 'TICKET_WAITING_APPROVAL') then
    v_titulo := case p_evento
                  when 'TICKET_WAITING_PART' then 'Aguardando peça'
                  else 'Aguardando aprovação' end;
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo,
        'Chamado #' || v_call.code || ' parado: ' || lower(v_titulo) || '.',
        'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_RATED' then
    v_corpo := 'O cliente avaliou o chamado #' || v_call.code ||
               coalesce(' com ' || (p_metadata->>'rating') || ' estrela(s)', '') || '.';
    perform public.notificar(v_tecnico, p_evento, 'Avaliação recebida', v_corpo, 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Avaliação recebida', v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;

  -- -------------------------------------------------------------------
  -- Mensagens: vai para o outro lado da conversa, nunca para quem escreveu
  -- -------------------------------------------------------------------
  elsif p_evento = 'MESSAGE_RECEIVED' then
    if (p_metadata->>'autor') = 'cliente' then
      perform public.notificar(v_tecnico, p_evento, 'Mensagem do cliente',
        coalesce(v_nome_cli, 'O cliente') || ' enviou uma mensagem no chamado #' || v_call.code || '.',
        'chamado', v_call.id, p_metadata);
      for v_admin in select public.perfis_admin() loop
        perform public.notificar(v_admin, p_evento, 'Mensagem do cliente',
          coalesce(v_nome_cli, 'O cliente') || ' escreveu no chamado #' || v_call.code || '.',
          'chamado', v_call.id, p_metadata);
      end loop;
    else
      perform public.notificar(v_cliente, p_evento, 'Mensagem da equipe',
        'Você recebeu uma mensagem sobre o chamado #' || v_call.code || '.',
        'chamado', v_call.id, p_metadata);
    end if;

  -- -------------------------------------------------------------------
  -- Estoque e financeiro: assunto da administração
  -- -------------------------------------------------------------------
  elsif p_evento in ('STOCK_LOW', 'STOCK_ENTRY', 'STOCK_EXIT',
                     'QUOTE_CREATED', 'QUOTE_APPROVED', 'QUOTE_REJECTED',
                     'PAYMENT_PENDING', 'PAYMENT_CONFIRMED',
                     'SCHEDULE_CREATED', 'SCHEDULE_CHANGED', 'SCHEDULE_CANCELLED',
                     'TECHNICIAN_AVAILABLE', 'TECHNICIAN_UNAVAILABLE') then
    v_titulo := coalesce(p_metadata->>'titulo', 'Atualização da operação');
    v_corpo  := coalesce(p_metadata->>'corpo', '');
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo, v_corpo, p_entity_type, p_entity_id, p_metadata);
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Gatilhos
-- ---------------------------------------------------------------------

-- Abertura de chamado
create or replace function public.tg_notificar_chamado_criado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notificar_evento(
    case when new.priority = 'urgente' then 'TICKET_URGENT' else 'NEW_TICKET' end,
    'chamado', new.id, '{}');
  return new;
exception when others then
  -- Notificação nunca pode derrubar a operação que a originou.
  raise warning 'Notificação de novo chamado falhou (%): %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists service_calls_notifica_criacao on public.service_calls;
create trigger service_calls_notifica_criacao
  after insert on public.service_calls
  for each row execute function public.tg_notificar_chamado_criado();

-- Atribuição de técnico e mudanças de status
create or replace function public.tg_notificar_chamado_atualizado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.technician_id is distinct from old.technician_id and new.technician_id is not null then
    perform public.notificar_evento('TICKET_ASSIGNED', 'chamado', new.id, '{}');
  end if;

  if new.status is distinct from old.status then
    perform public.notificar_evento(
      case new.status
        when 'tecnico_atribuido'    then 'TICKET_ACCEPTED'
        when 'a_caminho'            then 'TICKET_EN_ROUTE'
        when 'em_atendimento'       then 'TICKET_STARTED'
        when 'finalizado'           then 'TICKET_FINISHED'
        when 'cancelado'            then 'TICKET_CANCELLED'
        when 'aguardando_peca'      then 'TICKET_WAITING_PART'
        when 'aguardando_aprovacao' then 'TICKET_WAITING_APPROVAL'
        else null
      end,
      'chamado', new.id, '{}');
  end if;

  return new;
exception when others then
  raise warning 'Notificação de atualização falhou (%): %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists service_calls_notifica_atualizacao on public.service_calls;
create trigger service_calls_notifica_atualizacao
  after update of status, technician_id on public.service_calls
  for each row execute function public.tg_notificar_chamado_atualizado();

-- Avaliação do cliente
create or replace function public.tg_notificar_avaliacao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notificar_evento('TICKET_RATED', 'chamado', new.service_call_id,
    jsonb_build_object('rating', new.rating));
  return new;
exception when others then
  raise warning 'Notificação de avaliação falhou: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists service_ratings_notifica on public.service_ratings;
create trigger service_ratings_notifica
  after insert on public.service_ratings
  for each row execute function public.tg_notificar_avaliacao();

-- Estoque abaixo do mínimo
create or replace function public.tg_notificar_estoque_baixo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_nome text;
begin
  -- Só no cruzamento da linha: sem isso, toda saída de item já baixo geraria
  -- uma notificação nova e a caixa do administrador viraria ruído.
  if new.quantity <= new.min_quantity
     and (tg_op = 'INSERT' or old.quantity > old.min_quantity) then
    select name into v_nome from public.parts where id = new.part_id;
    perform public.notificar_evento('STOCK_LOW', 'estoque', new.part_id,
      jsonb_build_object(
        'titulo', 'Estoque baixo',
        'corpo', 'O item ' || coalesce(v_nome, 'sem nome') || ' está com ' ||
                 new.quantity || ' abaixo do mínimo de ' || new.min_quantity || '.'));
  end if;
  return new;
exception when others then
  raise warning 'Notificação de estoque falhou: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists inventory_notifica_baixo on public.inventory;
create trigger inventory_notifica_baixo
  after insert or update of quantity, min_quantity on public.inventory
  for each row execute function public.tg_notificar_estoque_baixo();

-- ---------------------------------------------------------------------
-- 8) RLS
--
-- A política antiga deixava o administrador ler a caixa de QUALQUER pessoa,
-- inclusive as notificações pessoais de clientes. Notificação de admin já é
-- endereçada ao admin pelo motor; ler a dos outros é acesso sem necessidade.
-- ---------------------------------------------------------------------
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select using (profile_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Escrita direta some: quem cria notificação é a função `notificar`.
drop policy if exists notifications_admin_write on public.notifications;

alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table public.notification_events enable row level security;
drop policy if exists notification_events_read on public.notification_events;
create policy notification_events_read on public.notification_events
  for select using (auth.uid() is not null);

revoke all on function public.notificar(uuid, text, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.notificar_evento(text, text, uuid, jsonb) from public, anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 9) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from public.notification_events)                        as eventos_catalogados,
  (select count(*) from pg_trigger
     where tgrelid = 'public.service_calls'::regclass
       and tgname like 'service_calls_notifica%')                          as gatilhos_chamado_deve_ser_2,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'notifications'
       and column_name in ('tipo','categoria','entity_type','entity_id','priority','push_sent','metadata'))
                                                                           as colunas_novas_deve_ser_7;
