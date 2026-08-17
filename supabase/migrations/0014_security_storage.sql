-- JEmpreendimentos: hardening de RPCs expostas e Storage privado

-- Funções de trigger não devem ser chamadas via API.
revoke all on function public.apply_inventory_movement() from public, anon, authenticated;
revoke all on function public.consume_part_on_service() from public, anon, authenticated;
revoke all on function public.validate_equipment_ownership() from public, anon, authenticated;

-- Helpers de autorização podem ser usados apenas por sessões autenticadas.
revoke execute on function public.auth_role() from anon;
revoke execute on function public.my_client_id() from anon;
revoke execute on function public.my_technician_id() from anon;
revoke execute on function public.can_see_call(uuid) from anon;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.my_client_id() to authenticated;
grant execute on function public.my_technician_id() to authenticated;
grant execute on function public.can_see_call(uuid) to authenticated;

-- RPCs administrativas mantêm a checagem interna is_admin(), mas nunca ficam disponíveis ao anon.
revoke execute on function public.admin_distribute_service_call(uuid) from anon;
revoke execute on function public.admin_update_service_call(uuid, text, text, public.service_priority, text, text, timestamptz, uuid, boolean, public.service_status) from anon;

-- A leitura de evidências deve respeitar o vínculo com a OS, não apenas o login.
drop policy if exists storage_authenticated_read on storage.objects;
drop policy if exists storage_service_evidence_read on storage.objects;
create policy storage_service_evidence_read on storage.objects
  for select to authenticated
  using (
    (bucket_id = 'service-photos' and exists (
      select 1 from public.service_photos sp
      where sp.storage_path = name
        and public.can_see_call(sp.service_call_id)
    ))
    or (bucket_id = 'signatures' and exists (
      select 1 from public.signatures sg
      where sg.storage_path = name
        and public.can_see_call(sg.service_call_id)
    ))
    or (bucket_id in ('documents', 'equipment-photos') and public.is_admin())
  );
