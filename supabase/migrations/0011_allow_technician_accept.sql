create or replace function public.enforce_service_call_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if old.status in ('finalizado', 'cancelado') then raise exception 'Chamado encerrado não pode mudar de status'; end if;
    if not (
      (old.status = 'aberto' and new.status in ('em_analise', 'tecnico_atribuido', 'cancelado')) or
      (old.status = 'em_analise' and new.status in ('aguardando_tecnico', 'tecnico_atribuido', 'cancelado')) or
      (old.status = 'aguardando_tecnico' and new.status in ('tecnico_atribuido', 'cancelado')) or
      (old.status = 'tecnico_atribuido' and new.status in ('a_caminho', 'aguardando_tecnico', 'cancelado')) or
      (old.status = 'a_caminho' and new.status in ('em_atendimento', 'cancelado')) or
      (old.status = 'em_atendimento' and new.status in ('aguardando_peca', 'aguardando_aprovacao', 'finalizado', 'cancelado')) or
      (old.status = 'aguardando_peca' and new.status in ('em_atendimento', 'cancelado')) or
      (old.status = 'aguardando_aprovacao' and new.status in ('em_atendimento', 'finalizado', 'cancelado'))
    ) then raise exception 'Transição de % para % não é permitida', old.status, new.status; end if;
    if new.status in ('tecnico_atribuido', 'a_caminho', 'em_atendimento') and new.technician_id is null then raise exception 'O chamado precisa de técnico atribuído antes deste status'; end if;
    if new.status = 'em_atendimento' and new.started_at is null then new.started_at := now(); end if;
    if new.status = 'finalizado' and new.finished_at is null then new.finished_at := now(); end if;
  end if;
  if new.technician_id is not null and not exists (select 1 from public.technicians t where t.id = new.technician_id and t.active = true) then raise exception 'Técnico inválido ou inativo'; end if;
  if tg_op = 'UPDATE' and not public.is_admin() and new.technician_id is distinct from old.technician_id and coalesce(current_setting('app.internal_assignment', true), '') <> 'on' then raise exception 'Somente o administrador pode atribuir ou trocar o técnico'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_service_call_transition() from public, anon, authenticated;
