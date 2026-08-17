-- Round Robin Inteligente: distribuição automática, explicável e configurável.

create table if not exists public.service_distribution_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  default_duration_minutes integer not null default 90 check (default_duration_minutes between 5 and 1440),
  default_sla_minutes integer not null default 240 check (default_sla_minutes between 5 and 10080),
  weight_availability numeric(5,2) not null default 30 check (weight_availability >= 0),
  weight_specialty numeric(5,2) not null default 25 check (weight_specialty >= 0),
  weight_workload numeric(5,2) not null default 20 check (weight_workload >= 0),
  weight_duration numeric(5,2) not null default 10 check (weight_duration >= 0),
  weight_location numeric(5,2) not null default 10 check (weight_location >= 0),
  weight_round_robin numeric(5,2) not null default 5 check (weight_round_robin >= 0),
  max_concurrent_calls integer not null default 3 check (max_concurrent_calls between 1 and 50),
  allow_without_specialty boolean not null default false,
  allow_after_hours boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  work_days smallint[] not null default '{1,2,3,4,5,6,7}',
  work_start time not null default '00:00',
  work_end time not null default '23:59',
  escalation_after_minutes integer not null default 30 check (escalation_after_minutes >= 1),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.service_distribution_settings (singleton)
values (true)
on conflict (singleton) do nothing;

drop trigger if exists service_distribution_settings_touch on public.service_distribution_settings;
create trigger service_distribution_settings_touch before update on public.service_distribution_settings
for each row execute function public.touch_updated_at();

create table if not exists public.service_distribution_rules (
  id uuid primary key default gen_random_uuid(),
  service_type public.service_type,
  priority public.service_priority,
  required_specialties text[] not null default '{}',
  standard_duration_minutes integer check (standard_duration_minutes is null or standard_duration_minutes between 5 and 1440),
  sla_minutes integer check (sla_minutes is null or sla_minutes between 5 and 10080),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_distribution_rules_lookup_idx
on public.service_distribution_rules (service_type, priority) where active;

drop trigger if exists service_distribution_rules_touch on public.service_distribution_rules;
create trigger service_distribution_rules_touch before update on public.service_distribution_rules
for each row execute function public.touch_updated_at();

create table if not exists public.technician_distribution_profiles (
  technician_id uuid primary key references public.technicians(id) on delete cascade,
  work_days smallint[] not null default '{1,2,3,4,5,6,7}',
  work_start time not null default '00:00',
  work_end time not null default '23:59',
  timezone text not null default 'America/Sao_Paulo',
  max_concurrent_calls integer not null default 3 check (max_concurrent_calls between 1 and 50),
  service_area text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  blocked_until timestamptz,
  absence_reason text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists technician_distribution_profiles_touch on public.technician_distribution_profiles;
create trigger technician_distribution_profiles_touch before update on public.technician_distribution_profiles
for each row execute function public.touch_updated_at();

insert into public.technician_distribution_profiles (technician_id)
select t.id from public.technicians t
on conflict (technician_id) do nothing;

create table if not exists public.technician_service_durations (
  technician_id uuid not null references public.technicians(id) on delete cascade,
  service_type public.service_type not null,
  manual_duration_minutes integer check (manual_duration_minutes is null or manual_duration_minutes between 5 and 1440),
  observed_average_minutes numeric(8,2),
  observed_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (technician_id, service_type)
);

drop trigger if exists technician_service_durations_touch on public.technician_service_durations;
create trigger technician_service_durations_touch before update on public.technician_service_durations
for each row execute function public.touch_updated_at();

create table if not exists public.service_distribution_runs (
  id uuid primary key default gen_random_uuid(),
  service_call_id uuid not null references public.service_calls(id) on delete cascade,
  selected_technician_id uuid references public.technicians(id) on delete set null,
  estimated_duration_minutes integer not null,
  candidate_scores jsonb not null default '[]'::jsonb,
  explanation text not null,
  algorithm_version text not null default 'round-robin-inteligente-v1',
  created_at timestamptz not null default now()
);
create index if not exists service_distribution_runs_call_idx on public.service_distribution_runs (service_call_id, created_at desc);
create index if not exists service_distribution_runs_tech_idx on public.service_distribution_runs (selected_technician_id, created_at desc);

alter table public.service_distribution_settings enable row level security;
alter table public.service_distribution_rules enable row level security;
alter table public.technician_distribution_profiles enable row level security;
alter table public.technician_service_durations enable row level security;
alter table public.service_distribution_runs enable row level security;

drop policy if exists distribution_settings_admin_read on public.service_distribution_settings;
create policy distribution_settings_admin_read on public.service_distribution_settings for select using (public.is_admin());
drop policy if exists distribution_settings_admin_write on public.service_distribution_settings;
create policy distribution_settings_admin_write on public.service_distribution_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists distribution_rules_admin_read on public.service_distribution_rules;
create policy distribution_rules_admin_read on public.service_distribution_rules for select using (public.is_admin());
drop policy if exists distribution_rules_admin_write on public.service_distribution_rules;
create policy distribution_rules_admin_write on public.service_distribution_rules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists technician_distribution_admin_all on public.technician_distribution_profiles;
create policy technician_distribution_admin_all on public.technician_distribution_profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists technician_distribution_self_read on public.technician_distribution_profiles;
create policy technician_distribution_self_read on public.technician_distribution_profiles for select using (technician_id = public.my_technician_id());

drop policy if exists technician_duration_admin_all on public.technician_service_durations;
create policy technician_duration_admin_all on public.technician_service_durations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists technician_duration_self_read on public.technician_service_durations;
create policy technician_duration_self_read on public.technician_service_durations for select using (technician_id = public.my_technician_id());

drop policy if exists distribution_runs_admin_read on public.service_distribution_runs;
create policy distribution_runs_admin_read on public.service_distribution_runs for select using (public.is_admin());
drop policy if exists distribution_runs_tech_read on public.service_distribution_runs;
create policy distribution_runs_tech_read on public.service_distribution_runs for select using (selected_technician_id = public.my_technician_id());

create or replace function public.distribute_service_call(p_service_call_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.service_calls%rowtype;
  v_config public.service_distribution_settings%rowtype;
  v_call_lat numeric;
  v_call_lon numeric;
  v_standard_minutes integer;
  v_required text[];
  v_estimated_minutes integer;
  v_candidate record;
  v_best_technician uuid;
  v_best_name text;
  v_best_score numeric := -1;
  v_best_last_assigned timestamptz;
  v_best_factors jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_score numeric;
  v_availability numeric;
  v_specialty numeric;
  v_workload numeric;
  v_duration numeric;
  v_location numeric;
  v_round_robin numeric;
  v_schedule_ok boolean;
  v_distance numeric;
  v_now timestamp;
begin
  select * into v_call from public.service_calls where id = p_service_call_id limit 1;
  if not found or v_call.technician_id is not null then return v_call.technician_id; end if;

  select * into v_config from public.service_distribution_settings where singleton = true limit 1;
  if not found then
    insert into public.service_distribution_settings (singleton) values (true) returning * into v_config;
  end if;

  select a.latitude, a.longitude into v_call_lat, v_call_lon
  from public.client_addresses a where a.id = v_call.address_id limit 1;

  select coalesce((select r.standard_duration_minutes from public.service_distribution_rules r
    where r.active and (r.service_type is null or r.service_type = v_call.service_type)
      and (r.priority is null or r.priority = v_call.priority)
    order by (r.service_type is not null)::int desc, (r.priority is not null)::int desc, r.updated_at desc limit 1), v_config.default_duration_minutes),
    coalesce((select r.required_specialties from public.service_distribution_rules r
    where r.active and (r.service_type is null or r.service_type = v_call.service_type)
      and (r.priority is null or r.priority = v_call.priority)
    order by (r.service_type is not null)::int desc, (r.priority is not null)::int desc, r.updated_at desc limit 1), '{}'::text[])
  into v_standard_minutes, v_required;

  for v_candidate in
    select t.id, t.specialties, p.full_name,
      coalesce(tp.max_concurrent_calls, v_config.max_concurrent_calls) as max_concurrent_calls,
      tp.work_days, tp.work_start, tp.work_end, tp.timezone, tp.latitude, tp.longitude,
      tp.blocked_until, coalesce(active_calls.total, 0)::int as active_calls,
      last_run.created_at as last_assigned_at
    from public.technicians t
    join public.profiles p on p.id = t.profile_id and p.active
    left join public.technician_distribution_profiles tp on tp.technician_id = t.id
    left join lateral (
      select count(*)::int as total from public.service_calls sc
      where sc.technician_id = t.id and sc.status not in ('finalizado', 'cancelado')
    ) active_calls on true
    left join lateral (
      select dr.created_at from public.service_distribution_runs dr
      where dr.selected_technician_id = t.id order by dr.created_at desc limit 1
    ) last_run on true
    where t.active and t.status <> 'indisponivel'
      and (tp.blocked_until is null or tp.blocked_until <= now())
      and coalesce(active_calls.total, 0) < coalesce(tp.max_concurrent_calls, v_config.max_concurrent_calls)
  loop
    v_now := now() at time zone coalesce(v_candidate.timezone, v_config.timezone);
    v_schedule_ok := extract(isodow from v_now)::int = any(coalesce(v_candidate.work_days, v_config.work_days))
      and v_now::time >= coalesce(v_candidate.work_start, v_config.work_start)
      and v_now::time <= coalesce(v_candidate.work_end, v_config.work_end);

    if not v_schedule_ok and not v_config.allow_after_hours then continue; end if;
    if v_call.priority in ('alta', 'urgente') and not v_schedule_ok then continue; end if;
    if cardinality(coalesce(v_required, '{}')) > 0 and not (coalesce(v_required, '{}') <@ coalesce(v_candidate.specialties, '{}')) and not v_config.allow_without_specialty then continue; end if;

    v_availability := case when v_schedule_ok and v_candidate.active_calls = 0 then 100 when v_schedule_ok then 70 else 25 end;
    v_specialty := case when cardinality(coalesce(v_required, '{}')) = 0 then 100 when coalesce(v_required, '{}') <@ coalesce(v_candidate.specialties, '{}') then 100 else 40 end;
    v_workload := greatest(0, 100 - least(100, (v_candidate.active_calls::numeric / greatest(v_candidate.max_concurrent_calls, 1)) * 100));

    select coalesce(d.manual_duration_minutes, round(d.observed_average_minutes)::int, v_standard_minutes)
    into v_estimated_minutes from public.technician_service_durations d
    where d.technician_id = v_candidate.id and d.service_type = v_call.service_type limit 1;
    v_estimated_minutes := coalesce(v_estimated_minutes, v_standard_minutes, v_config.default_duration_minutes);
    v_duration := greatest(0, 100 - ((v_estimated_minutes::numeric / greatest(v_standard_minutes, 1)) * 50));

    if v_call_lat is not null and v_call_lon is not null and v_candidate.latitude is not null and v_candidate.longitude is not null then
      v_distance := 6371 * 2 * asin(sqrt(power(sin(radians(v_candidate.latitude - v_call_lat) / 2), 2) + cos(radians(v_call_lat)) * cos(radians(v_candidate.latitude)) * power(sin(radians(v_candidate.longitude - v_call_lon) / 2), 2)));
      v_location := greatest(0, 100 - least(100, v_distance));
    else
      v_distance := null;
      v_location := 50;
    end if;

    v_round_robin := case when v_candidate.last_assigned_at is null then 100 else least(100, greatest(0, extract(epoch from (now() - v_candidate.last_assigned_at)) / 3600 * 10)) end;
    v_score := round((v_availability * v_config.weight_availability + v_specialty * v_config.weight_specialty + v_workload * v_config.weight_workload + v_duration * v_config.weight_duration + v_location * v_config.weight_location + v_round_robin * v_config.weight_round_robin) / greatest(v_config.weight_availability + v_config.weight_specialty + v_config.weight_workload + v_config.weight_duration + v_config.weight_location + v_config.weight_round_robin, 1), 2);
    v_candidates := v_candidates || jsonb_build_array(jsonb_build_object('technician_id', v_candidate.id, 'technician_name', v_candidate.full_name, 'score', v_score, 'availability', round(v_availability, 2), 'specialty', round(v_specialty, 2), 'workload', round(v_workload, 2), 'duration', round(v_duration, 2), 'location', round(v_location, 2), 'distance_km', v_distance, 'round_robin', round(v_round_robin, 2), 'active_calls', v_candidate.active_calls, 'estimated_minutes', v_estimated_minutes));

    if v_score > v_best_score or (v_score = v_best_score and coalesce(v_candidate.last_assigned_at, 'epoch'::timestamptz) < coalesce(v_best_last_assigned, 'epoch'::timestamptz)) then
      v_best_score := v_score;
      v_best_technician := v_candidate.id;
      v_best_name := v_candidate.full_name;
      v_best_last_assigned := v_candidate.last_assigned_at;
      v_best_factors := jsonb_build_object('availability', round(v_availability, 2), 'specialty', round(v_specialty, 2), 'workload', round(v_workload, 2), 'duration', round(v_duration, 2), 'location', round(v_location, 2), 'round_robin', round(v_round_robin, 2), 'distance_km', v_distance, 'estimated_minutes', v_estimated_minutes);
    end if;
  end loop;

  if v_best_technician is null then
    insert into public.service_distribution_runs (service_call_id, estimated_duration_minutes, candidate_scores, explanation)
    values (v_call.id, coalesce(v_standard_minutes, v_config.default_duration_minutes), v_candidates, 'Nenhum técnico elegível. O chamado permanece aguardando distribuição e deve ser escalonado pelo administrador.');
    return null;
  end if;

  perform set_config('app.internal_assignment', 'on', true);
  update public.service_calls set technician_id = v_best_technician, updated_at = now() where id = v_call.id;
  insert into public.service_distribution_runs (service_call_id, selected_technician_id, estimated_duration_minutes, candidate_scores, explanation)
  values (v_call.id, v_best_technician, coalesce((v_best_factors->>'estimated_minutes')::int, v_standard_minutes, v_config.default_duration_minutes), v_candidates,
    format('Técnico %s selecionado com %.2f pontos: disponibilidade, especialidade, carga de trabalho, tempo estimado, localização e Round Robin foram considerados.', v_best_name, v_best_score));
  return v_best_technician;
end;
$$;

create or replace function public.auto_assign_service_call_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.technician_id is null and new.status in ('aberto', 'em_analise', 'aguardando_tecnico') then
    perform public.distribute_service_call(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists service_calls_auto_assign on public.service_calls;
create trigger service_calls_auto_assign
after insert on public.service_calls
for each row execute function public.auto_assign_service_call_trigger();

create or replace function public.admin_distribute_service_call(p_service_call_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Somente o administrador pode redistribuir chamados'; end if;
  return public.distribute_service_call(p_service_call_id);
end;
$$;

grant execute on function public.admin_distribute_service_call(uuid) to authenticated;
revoke all on function public.distribute_service_call(uuid) from public, anon, authenticated;
revoke all on function public.auto_assign_service_call_trigger() from public, anon, authenticated;

create or replace function public.learn_service_call_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes numeric;
  v_type public.service_type;
begin
  if new.status = 'finalizado' and new.started_at is not null and new.finished_at is not null and new.technician_id is not null then
    v_minutes := greatest(1, extract(epoch from (new.finished_at - new.started_at)) / 60);
    v_type := new.service_type;
    insert into public.technician_service_durations (technician_id, service_type, observed_average_minutes, observed_count)
    values (new.technician_id, v_type, v_minutes, 1)
    on conflict (technician_id, service_type) do update set
      observed_average_minutes = ((technician_service_durations.observed_average_minutes * technician_service_durations.observed_count) + excluded.observed_average_minutes) / (technician_service_durations.observed_count + 1),
      observed_count = technician_service_durations.observed_count + 1,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists service_calls_learn_duration on public.service_calls;
create trigger service_calls_learn_duration
after update of status, started_at, finished_at on public.service_calls
for each row execute function public.learn_service_call_duration();

revoke all on function public.learn_service_call_duration() from public, anon, authenticated;

-- Permite que o motor interno atribua um chamado sem abrir exceção às regras de usuário.
create or replace function public.enforce_service_call_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status in ('finalizado', 'cancelado') then
      raise exception 'Chamado encerrado não pode mudar de status';
    end if;
    if not (
      (old.status = 'aberto' and new.status in ('em_analise', 'cancelado')) or
      (old.status = 'em_analise' and new.status in ('aguardando_tecnico', 'cancelado')) or
      (old.status = 'aguardando_tecnico' and new.status in ('tecnico_atribuido', 'cancelado')) or
      (old.status = 'tecnico_atribuido' and new.status in ('a_caminho', 'aguardando_tecnico', 'cancelado')) or
      (old.status = 'a_caminho' and new.status in ('em_atendimento', 'cancelado')) or
      (old.status = 'em_atendimento' and new.status in ('aguardando_peca', 'aguardando_aprovacao', 'finalizado', 'cancelado')) or
      (old.status = 'aguardando_peca' and new.status in ('em_atendimento', 'cancelado')) or
      (old.status = 'aguardando_aprovacao' and new.status in ('em_atendimento', 'finalizado', 'cancelado'))
    ) then
      raise exception 'Transição de % para % não é permitida', old.status, new.status;
    end if;
    if new.status in ('tecnico_atribuido', 'a_caminho', 'em_atendimento') and new.technician_id is null then
      raise exception 'O chamado precisa de técnico atribuído antes deste status';
    end if;
    if new.status = 'em_atendimento' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'finalizado' and new.finished_at is null then new.finished_at := now(); end if;
  end if;
  if new.technician_id is not null and not exists (select 1 from public.technicians t where t.id = new.technician_id and t.active = true) then
    raise exception 'Técnico inválido ou inativo';
  end if;
  if tg_op = 'UPDATE' and not public.is_admin() and new.technician_id is distinct from old.technician_id and coalesce(current_setting('app.internal_assignment', true), '') <> 'on' then
    raise exception 'Somente o administrador pode atribuir ou trocar o técnico';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_service_call_transition() from public, anon, authenticated;

-- A função administrativa só pode ser chamada por sessões autenticadas; o próprio corpo valida admin.
revoke all on function public.admin_distribute_service_call(uuid) from public, anon;
grant execute on function public.admin_distribute_service_call(uuid) to authenticated;
