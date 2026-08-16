-- Hardening: funções de trigger e autorização não devem ficar expostas ao anon.
alter function public.touch_updated_at() set search_path = public;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_service_call_status() from public, anon, authenticated;
revoke all on function public.create_equipment_qr() from public, anon, authenticated;
revoke all on function public.enforce_service_call_transition() from public, anon, authenticated;
revoke all on function public.validate_service_call_ownership() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

revoke all on function public.auth_role() from anon;
revoke all on function public.is_admin() from anon;
revoke all on function public.my_client_id() from anon;
revoke all on function public.my_technician_id() from anon;
revoke all on function public.can_see_call(uuid) from anon;
revoke all on function public.apply_inventory_movement() from anon;
revoke all on function public.consume_part_on_service() from anon;

-- Helpers de RLS continuam disponíveis somente para sessões autenticadas.
grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_client_id() to authenticated;
grant execute on function public.my_technician_id() to authenticated;
grant execute on function public.can_see_call(uuid) to authenticated;
grant execute on function public.apply_inventory_movement() to authenticated;
grant execute on function public.consume_part_on_service() to authenticated;
