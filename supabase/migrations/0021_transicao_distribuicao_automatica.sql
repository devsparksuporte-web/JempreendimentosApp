-- =====================================================================
-- JEmpreendimentos — Máquina de estados x distribuição automática
--
-- As transições da 0005 foram escritas para uma triagem manual:
--
--   aberto → em_analise → aguardando_tecnico → tecnico_atribuido → …
--
-- A distribuição automática (0017) veio depois e atribui o técnico já no
-- momento em que o chamado nasce, com status `aberto`. Os dois estados do
-- meio simplesmente não acontecem nesse caminho. Resultado: o técnico
-- tocava em "Aceitar chamado" e levava
-- "Transição de aberto para tecnico_atribuido não é permitida".
--
-- Aqui o caminho curto passa a ser reconhecido — mas só ele. Nada mais da
-- máquina de estados muda, e a exigência de ter técnico atribuído antes de
-- `tecnico_atribuido` continua valendo logo abaixo, o que impede pular
-- etapa sem alguém responsável pelo chamado.
-- =====================================================================

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
      -- Caminho curto da distribuição automática: o técnico já está no
      -- chamado desde a abertura, então aceitar é o passo seguinte.
      (old.status in ('aberto', 'em_analise') and new.status = 'tecnico_atribuido'
        and new.technician_id is not null) or

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

-- ---------------------------------------------------------------------
-- Conferência: o gatilho continua no lugar, apontando para a função nova.
-- ---------------------------------------------------------------------
select
  (select count(*) from pg_trigger
    where tgrelid = 'public.service_calls'::regclass
      and tgname = 'service_calls_enforce_transition') as gatilho_deve_ser_1,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'enforce_service_call_transition'
      and pg_get_functiondef(p.oid) like '%Caminho curto da distribuição%') as funcao_atualizada_deve_ser_1;
