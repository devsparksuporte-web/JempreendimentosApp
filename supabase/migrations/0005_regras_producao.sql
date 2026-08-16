-- Regras de produção: nenhum dado demonstrativo e nenhuma transição inválida.

-- Todo usuário novo começa com um perfil cliente e um registro real de cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(v_name, split_part(new.email, '@', 1)), 'cliente')
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end;

  insert into public.clients (profile_id, name, email, active)
  values (new.id, coalesce(v_name, split_part(new.email, '@', 1)), new.email, true)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- O atalho que fabricava cliente, equipamentos, técnico e chamado é proibido em produção.
drop function if exists public.seed_demo_for_current_user();

-- Valida o vínculo entre o chamado e os dados pertencentes ao cliente autenticado.
create or replace function public.validate_service_call_ownership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_client_id uuid;
begin
  if tg_op = 'INSERT' then
    select c.id into v_client_id
      from public.clients c
     where c.id = new.client_id
       and c.active = true
       and (public.is_admin() or c.id = public.my_client_id());

    if v_client_id is null then
      raise exception 'Cliente inválido ou sem permissão para abrir este chamado';
    end if;
  elsif not public.is_admin() and new.client_id is distinct from old.client_id then
    raise exception 'O cliente do chamado não pode ser alterado';
  end if;

  if new.equipment_id is not null and not exists (
    select 1 from public.equipment e
     where e.id = new.equipment_id
       and e.client_id = new.client_id
       and e.active = true
  ) then
    raise exception 'Equipamento não pertence ao cliente informado';
  end if;

  if new.address_id is not null and not exists (
    select 1 from public.client_addresses a
     where a.id = new.address_id
       and a.client_id = new.client_id
  ) then
    raise exception 'Endereço não pertence ao cliente informado';
  end if;

  if tg_op = 'INSERT' and length(trim(coalesce(new.title, ''))) < 4 then
    raise exception 'O título do chamado deve ter pelo menos 4 caracteres';
  end if;

  if tg_op = 'INSERT' and new.status is distinct from 'aberto' and not public.is_admin() then
    raise exception 'Novos chamados devem iniciar como aberto';
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;
drop trigger if exists service_calls_validate_ownership on public.service_calls;
create trigger service_calls_validate_ownership
before insert or update of client_id, equipment_id, address_id, status, title on public.service_calls
for each row execute function public.validate_service_call_ownership();

-- Transições permitidas e preenchimento consistente dos timestamps operacionais.
create or replace function public.enforce_service_call_transition()
returns trigger
language plpgsql
security definer set search_path = public
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

    if new.status = 'em_atendimento' and new.started_at is null then
      new.started_at := now();
    end if;
    if new.status = 'finalizado' and new.finished_at is null then
      new.finished_at := now();
    end if;
  end if;

  if new.technician_id is not null and not exists (
    select 1 from public.technicians t where t.id = new.technician_id and t.active = true
  ) then
    raise exception 'Técnico inválido ou inativo';
  end if;

  if tg_op = 'UPDATE' and not public.is_admin() and new.technician_id is distinct from old.technician_id then
    raise exception 'Somente o administrador pode atribuir ou trocar o técnico';
  end if;

  return new;
end;
$$;
drop trigger if exists service_calls_enforce_transition on public.service_calls;
create trigger service_calls_enforce_transition
before update of status, technician_id, started_at, finished_at on public.service_calls
for each row execute function public.enforce_service_call_transition();

-- Clientes podem manter o próprio cadastro e endereços; equipamentos continuam sujeitos ao vínculo.
drop policy if exists clients_self_update on public.clients;
create policy clients_self_update on public.clients
for update using (profile_id = auth.uid())
with check (profile_id = auth.uid() and active = true);

drop policy if exists client_addresses_self_write on public.client_addresses;
create policy client_addresses_self_write on public.client_addresses
for all using (client_id = public.my_client_id())
with check (client_id = public.my_client_id());

drop policy if exists equipment_self_write on public.equipment;
create policy equipment_self_write on public.equipment
for all using (client_id = public.my_client_id())
with check (client_id = public.my_client_id());

-- O cliente não altera estado, técnico ou diagnóstico de um chamado já aberto.
drop policy if exists service_calls_update on public.service_calls;
create policy service_calls_update on public.service_calls
for update using (
  public.is_admin() or technician_id = public.my_technician_id()
)
with check (
  public.is_admin() or technician_id = public.my_technician_id()
);
