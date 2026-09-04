-- ---------------------------------------------------------------------
-- 0034 — Agenda do técnico: hora de fim e reserva sem sobreposição
--
-- Até aqui o agendamento era um instante: `service_calls.scheduled_for`,
-- sem fim. Sem fim não existe intervalo, e sem intervalo não existe
-- conflito — dava para marcar dez atendimentos do mesmo técnico às 14:00
-- e o banco aceitava todos.
--
-- A trava é uma EXCLUDE constraint com btree_gist, e não uma consulta
-- "já existe algo neste horário?" antes do update. A diferença importa:
-- a consulta tem uma janela entre ler e gravar em que outra transação
-- grava também, e as duas passam. A constraint é verificada pelo índice
-- dentro da transação — a segunda espera a primeira e falha. É a resposta
-- do Postgres para condição de corrida, sem lock manual e sem tabela de
-- reservas paralela.
--
-- Depende da 0033 (registrar_falha). Aplique naquela ordem.
-- ---------------------------------------------------------------------

do $$ begin
  if to_regprocedure('public.registrar_falha(text,uuid,text,text)') is null then
    raise exception 'Aplique antes a migração 0033 (falhas_de_gatilho).';
  end if;
end $$;

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- 1) O fim do atendimento
-- ---------------------------------------------------------------------
alter table public.service_calls
  add column if not exists scheduled_end timestamptz;

comment on column public.service_calls.scheduled_end is
  'Fim previsto do atendimento. Com scheduled_for forma o intervalo reservado na agenda do técnico.';

alter table public.service_calls drop constraint if exists service_calls_agenda_coerente;
alter table public.service_calls
  add constraint service_calls_agenda_coerente
  check (scheduled_end is null or (scheduled_for is not null and scheduled_end > scheduled_for));

-- ---------------------------------------------------------------------
-- 2) A reserva
--
-- `[)` — fim aberto: 14:00–15:00 e 15:00–16:00 não se sobrepõem, que é a
-- regra que a pessoa espera ao olhar a grade de horários.
--
-- Bloqueiam o horário todos os status menos `cancelado` e `finalizado`.
-- Escrito pela negativa de propósito: status novo no enum passa a
-- bloquear por padrão, que é o lado seguro do erro.
-- ---------------------------------------------------------------------
alter table public.service_calls drop constraint if exists service_calls_sem_conflito;
alter table public.service_calls
  add constraint service_calls_sem_conflito
  exclude using gist (
    technician_id with =,
    tstzrange(scheduled_for, scheduled_end, '[)') with &&
  )
  where (technician_id is not null
         and scheduled_for is not null
         and scheduled_end is not null
         and status not in ('cancelado', 'finalizado'));

-- ---------------------------------------------------------------------
-- 3) Duração padrão — reaproveita a configuração da distribuição
-- ---------------------------------------------------------------------
create or replace function public.duracao_padrao_de_atendimento()
returns integer
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select default_duration_minutes
                     from public.service_distribution_settings
                    where singleton limit 1), 90);
$$;

-- ---------------------------------------------------------------------
-- 4) Preenche o fim dos agendamentos que já existiam
--
-- Linha a linha, pulando a que colidir: agendamento antigo conflitante é
-- fato consumado e não pode impedir a migração de rodar. O aviso no fim
-- diz quantos ficaram sem reserva, para conferência manual.
-- ---------------------------------------------------------------------
do $$
declare
  v_dur   integer := public.duracao_padrao_de_atendimento();
  v_linha record;
  v_ok    integer := 0;
  v_pulou integer := 0;
begin
  for v_linha in
    select id, scheduled_for
      from public.service_calls
     where scheduled_for is not null
       and scheduled_end is null
       and status not in ('cancelado', 'finalizado')
     order by scheduled_for
  loop
    begin
      update public.service_calls
         set scheduled_end = v_linha.scheduled_for + make_interval(mins => v_dur)
       where id = v_linha.id;
      v_ok := v_ok + 1;
    exception when exclusion_violation then
      v_pulou := v_pulou + 1;
    end;
  end loop;
  raise notice 'Agenda: % agendamento(s) com fim preenchido, % pulado(s) por conflito antigo.', v_ok, v_pulou;
end $$;

-- ---------------------------------------------------------------------
-- 5) Agendar e reagendar
--
-- Mesma função para os dois: reagendar é gravar outro intervalo na mesma
-- linha, e o horário antigo se libera porque deixou de existir. Não há
-- "liberação" a fazer — o que reserva o horário é a própria linha do
-- chamado, não um registro à parte.
-- ---------------------------------------------------------------------
create or replace function public.agendar_atendimento(
  p_call_id         uuid,
  p_inicio          timestamptz,
  p_duracao_minutos integer default null,
  p_technician_id   uuid default null
)
returns public.service_calls
language plpgsql
security definer set search_path = public
as $$
declare
  v_call    public.service_calls%rowtype;
  v_tecnico uuid;
  v_dur     integer;
  v_fim     timestamptz;
  v_antes   timestamptz;
begin
  if p_inicio is null then
    raise exception 'Informe a data e a hora do atendimento.';
  end if;

  select * into v_call from public.service_calls where id = p_call_id for update;
  if not found then
    raise exception 'Chamado não encontrado.';
  end if;

  -- Administração, técnico do chamado e o cliente dono. É a mesma regra de
  -- quem já enxerga o chamado — não se inventa outra aqui.
  if not public.can_see_call(p_call_id) then
    raise exception 'Você não tem permissão para agendar este chamado.';
  end if;

  if v_call.status in ('cancelado', 'finalizado') then
    raise exception 'O chamado #% está %. Não é possível agendar.', v_call.code, v_call.status;
  end if;

  v_tecnico := coalesce(p_technician_id, v_call.technician_id);
  if v_tecnico is null then
    raise exception 'Defina o técnico responsável antes de agendar o atendimento.';
  end if;

  -- Só a administração troca o técnico junto com o agendamento.
  if p_technician_id is not null
     and p_technician_id is distinct from v_call.technician_id
     and not public.is_admin() then
    raise exception 'Apenas a administração pode trocar o técnico do chamado.';
  end if;

  v_antes := v_call.scheduled_for;
  v_dur := coalesce(
    p_duracao_minutos,
    case when v_call.scheduled_for is not null and v_call.scheduled_end is not null
         then greatest(5, (extract(epoch from (v_call.scheduled_end - v_call.scheduled_for)) / 60)::integer)
    end,
    public.duracao_padrao_de_atendimento());

  if v_dur < 5 or v_dur > 1440 then
    raise exception 'Duração inválida: % minutos.', v_dur;
  end if;
  v_fim := p_inicio + make_interval(mins => v_dur);

  update public.service_calls
     set scheduled_for = p_inicio,
         scheduled_end = v_fim,
         technician_id = v_tecnico
   where id = p_call_id
  returning * into v_call;

  -- O aviso não pode derrubar o agendamento, mas também não some calado.
  begin
    perform public.notificar_evento(
      case when v_antes is null then 'SCHEDULE_CREATED' else 'SCHEDULE_CHANGED' end,
      'chamado', p_call_id,
      jsonb_build_object('inicio', p_inicio, 'fim', v_fim, 'anterior', v_antes));
  exception when others then
    perform public.registrar_falha('agendar_atendimento', p_call_id, sqlerrm, 'aviso de agendamento');
  end;

  return v_call;

exception when exclusion_violation then
  if v_antes is null then
    raise exception 'Este técnico já possui um atendimento agendado para este horário. Escolha outro horário.'
      using errcode = '23P01';
  else
    raise exception 'Não é possível reagendar. O técnico já possui um atendimento neste horário.'
      using errcode = '23P01';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Cancelar o agendamento sem cancelar o chamado
--
-- Zera o intervalo: a linha deixa de participar da constraint e o horário
-- volta a ficar livre para qualquer outro chamado no mesmo instante.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_agendamento(p_call_id uuid, p_motivo text default null)
returns public.service_calls
language plpgsql
security definer set search_path = public
as $$
declare
  v_call  public.service_calls%rowtype;
  v_antes timestamptz;
begin
  select * into v_call from public.service_calls where id = p_call_id for update;
  if not found then
    raise exception 'Chamado não encontrado.';
  end if;
  if not public.can_see_call(p_call_id) then
    raise exception 'Você não tem permissão para alterar este agendamento.';
  end if;
  if v_call.scheduled_for is null then
    raise exception 'Este chamado não tem agendamento.';
  end if;

  v_antes := v_call.scheduled_for;

  update public.service_calls
     set scheduled_for = null,
         scheduled_end = null
   where id = p_call_id
  returning * into v_call;

  begin
    perform public.notificar_evento('SCHEDULE_CANCELLED', 'chamado', p_call_id,
      jsonb_build_object('anterior', v_antes, 'motivo', p_motivo));
  exception when others then
    perform public.registrar_falha('cancelar_agendamento', p_call_id, sqlerrm, 'aviso de cancelamento');
  end;

  return v_call;
end;
$$;

-- ---------------------------------------------------------------------
-- 7) Grade de horários do dia
--
-- Gera as faixas dentro do expediente já configurado na distribuição — os
-- mesmos work_days/work_start/work_end/timezone que o round robin usa.
-- Fora do expediente a faixa nem aparece: horário que não existe não é
-- "indisponível", é inexistente.
--
-- Detalhe do chamado só para quem já poderia vê-lo. Para o cliente que
-- está escolhendo horário, o vizinho de agenda é apenas "ocupado" — nome
-- e chamado de outro cliente não vazam por aqui.
-- ---------------------------------------------------------------------
create or replace function public.horarios_do_tecnico(
  p_technician_id uuid,
  p_dia           date,
  p_slot_minutos  integer default 60
)
returns table (
  inicio          timestamptz,
  fim             timestamptz,
  ocupado         boolean,
  service_call_id uuid,
  code            integer,
  cliente         text
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_cfg     public.service_distribution_settings%rowtype;
  v_abre    timestamptz;
  v_fecha   timestamptz;
  v_detalhe boolean;
begin
  if p_slot_minutos < 5 or p_slot_minutos > 480 then
    raise exception 'Tamanho de faixa inválido.';
  end if;

  select * into v_cfg from public.service_distribution_settings where singleton limit 1;
  if not found then
    raise exception 'Configuração de distribuição não encontrada.';
  end if;

  if not (extract(isodow from p_dia)::smallint = any (v_cfg.work_days)) then
    return;
  end if;

  v_abre  := (p_dia + v_cfg.work_start) at time zone v_cfg.timezone;
  v_fecha := (p_dia + v_cfg.work_end)   at time zone v_cfg.timezone;

  v_detalhe := public.is_admin() or p_technician_id = public.my_technician_id();

  return query
  with faixas as (
    select g as ini, g + make_interval(mins => p_slot_minutos) as fim
      from generate_series(v_abre,
                           v_fecha - make_interval(mins => p_slot_minutos),
                           make_interval(mins => p_slot_minutos)) as g
  )
  select f.ini,
         f.fim,
         sc.id is not null,
         case when v_detalhe then sc.id end,
         case when v_detalhe then sc.code end,
         case when v_detalhe then c.name end
    from faixas f
    left join public.service_calls sc
      on sc.technician_id = p_technician_id
     and sc.scheduled_for is not null
     and sc.scheduled_end is not null
     and sc.status not in ('cancelado', 'finalizado')
     and tstzrange(sc.scheduled_for, sc.scheduled_end, '[)') && tstzrange(f.ini, f.fim, '[)')
    left join public.clients c on c.id = sc.client_id
   order by f.ini;
end;
$$;

-- ---------------------------------------------------------------------
-- 8) O caminho antigo passa a respeitar a mesma regra
--
-- `admin_update_service_call` gravava scheduled_for sem fim, o que
-- deixaria o agendamento fora da reserva — um buraco por onde o conflito
-- voltaria. Agora calcula o fim e devolve a mesma mensagem.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_service_call(
  p_call_id uuid,
  p_title text default null,
  p_description text default null,
  p_priority public.service_priority default null,
  p_diagnosis text default null,
  p_solution text default null,
  p_scheduled_for timestamptz default null,
  p_technician_id uuid default null,
  p_set_technician boolean default false,
  p_status public.service_status default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur integer := public.duracao_padrao_de_atendimento();
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem editar todos os campos'; end if;
  update public.service_calls set
    title = coalesce(nullif(trim(p_title), ''), title),
    description = coalesce(p_description, description),
    priority = coalesce(p_priority, priority),
    diagnosis = coalesce(p_diagnosis, diagnosis),
    solution = coalesce(p_solution, solution),
    scheduled_for = coalesce(p_scheduled_for, scheduled_for),
    scheduled_end = case
      when p_scheduled_for is not null then p_scheduled_for + make_interval(mins => v_dur)
      else scheduled_end
    end,
    technician_id = case when p_set_technician then p_technician_id else technician_id end,
    status = coalesce(p_status, status)
  where id = p_call_id;
  if not found then raise exception 'Chamado não encontrado'; end if;
exception when exclusion_violation then
  raise exception 'Este técnico já possui um atendimento agendado para este horário. Escolha outro horário.'
    using errcode = '23P01';
end;
$$;

-- ---------------------------------------------------------------------
-- 9) Permissões — nada de execução pelo anônimo
-- ---------------------------------------------------------------------
revoke all on function public.agendar_atendimento(uuid, timestamptz, integer, uuid) from public, anon;
revoke all on function public.cancelar_agendamento(uuid, text) from public, anon;
revoke all on function public.horarios_do_tecnico(uuid, date, integer) from public, anon;
revoke all on function public.duracao_padrao_de_atendimento() from public, anon;

grant execute on function public.agendar_atendimento(uuid, timestamptz, integer, uuid) to authenticated;
grant execute on function public.cancelar_agendamento(uuid, text) to authenticated;
grant execute on function public.horarios_do_tecnico(uuid, date, integer) to authenticated;
grant execute on function public.duracao_padrao_de_atendimento() to authenticated;
