-- Remove a permissão herdada do papel PUBLIC.
-- As funções continuam acessíveis apenas quando a política/RPC exige sessão autenticada.
revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_client_id() from public, anon;
revoke execute on function public.my_technician_id() from public, anon;
revoke execute on function public.can_see_call(uuid) from public, anon;
revoke execute on function public.admin_distribute_service_call(uuid) from public, anon;
revoke execute on function public.admin_update_service_call(uuid, text, text, public.service_priority, text, text, timestamptz, uuid, boolean, public.service_status) from public, anon;
revoke execute on function public.client_cancel_service_call(uuid, text) from public, anon;

-- Funções usadas por policies precisam continuar disponíveis a authenticated.
grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_client_id() to authenticated;
grant execute on function public.my_technician_id() to authenticated;
grant execute on function public.can_see_call(uuid) to authenticated;
