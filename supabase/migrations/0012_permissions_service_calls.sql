create or replace function public.client_cancel_service_call(p_call_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_history_id uuid;
begin
  if not exists (select 1 from public.service_calls where id = p_call_id and client_id = public.my_client_id()) then
    raise exception 'Chamado não pertence ao cliente autenticado';
  end if;
  if exists (select 1 from public.service_calls where id = p_call_id and status in ('finalizado', 'cancelado')) then
    raise exception 'Este chamado já está encerrado';
  end if;
  update public.service_calls set status = 'cancelado' where id = p_call_id;
  select id into v_history_id from public.service_call_status_history where service_call_id = p_call_id order by created_at desc limit 1;
  if v_history_id is not null then update public.service_call_status_history set note = nullif(trim(p_reason), '') where id = v_history_id; end if;
end;
$$;

create or replace function public.technician_update_service_call(
  p_call_id uuid,
  p_title text default null,
  p_description text default null,
  p_diagnosis text default null,
  p_solution text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.service_calls where id = p_call_id and technician_id = public.my_technician_id()) then
    raise exception 'Chamado não está atribuído ao técnico autenticado';
  end if;
  if exists (select 1 from public.service_calls where id = p_call_id and status in ('finalizado', 'cancelado')) then
    raise exception 'Chamado encerrado não pode ser ajustado';
  end if;
  update public.service_calls set
    title = coalesce(nullif(trim(p_title), ''), title),
    description = coalesce(p_description, description),
    diagnosis = coalesce(p_diagnosis, diagnosis),
    solution = coalesce(p_solution, solution)
  where id = p_call_id;
end;
$$;

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
begin
  if not public.is_admin() then raise exception 'Apenas administradores podem editar todos os campos'; end if;
  update public.service_calls set
    title = coalesce(nullif(trim(p_title), ''), title),
    description = coalesce(p_description, description),
    priority = coalesce(p_priority, priority),
    diagnosis = coalesce(p_diagnosis, diagnosis),
    solution = coalesce(p_solution, solution),
    scheduled_for = coalesce(p_scheduled_for, scheduled_for),
    technician_id = case when p_set_technician then p_technician_id else technician_id end,
    status = coalesce(p_status, status)
  where id = p_call_id;
  if not found then raise exception 'Chamado não encontrado'; end if;
end;
$$;

revoke all on function public.client_cancel_service_call(uuid, text) from public, anon;
revoke all on function public.technician_update_service_call(uuid, text, text, text, text) from public, anon;
revoke all on function public.admin_update_service_call(uuid, text, text, public.service_priority, text, text, timestamptz, uuid, boolean, public.service_status) from public, anon;
grant execute on function public.client_cancel_service_call(uuid, text) to authenticated;
grant execute on function public.technician_update_service_call(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_update_service_call(uuid, text, text, public.service_priority, text, text, timestamptz, uuid, boolean, public.service_status) to authenticated;

-- Histórico é visível ao dono, técnico atribuído e administrador; mensagens seguem a mesma regra.
drop policy if exists sc_status_history_read on public.service_call_status_history;
create policy sc_status_history_read on public.service_call_status_history for select using (public.can_see_call(service_call_id));
