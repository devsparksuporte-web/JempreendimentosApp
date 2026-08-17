-- A função administrativa só pode ser chamada por sessões autenticadas.
revoke all on function public.admin_distribute_service_call(uuid) from public, anon;
grant execute on function public.admin_distribute_service_call(uuid) to authenticated;
