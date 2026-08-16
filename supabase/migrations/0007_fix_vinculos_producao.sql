-- Correções de produção: client_addresses não possui coluna active e vínculos
-- devem ser validados tanto na criação quanto na atualização.
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

create or replace function public.validate_equipment_ownership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() and new.client_id is distinct from old.client_id then
    raise exception 'O cliente do equipamento não pode ser alterado';
  end if;
  if new.address_id is not null and not exists (
    select 1 from public.client_addresses a
     where a.id = new.address_id
       and a.client_id = new.client_id
  ) then
    raise exception 'Endereço não pertence ao cliente do equipamento';
  end if;
  if new.client_id is null then
    raise exception 'Equipamento precisa de cliente';
  end if;
  return new;
end;
$$;
drop trigger if exists equipment_validate_ownership on public.equipment;
create trigger equipment_validate_ownership
before insert or update of client_id, address_id on public.equipment
for each row execute function public.validate_equipment_ownership();
