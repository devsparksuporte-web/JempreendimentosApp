-- =====================================================================
-- JEmpreendimentos — Condição operacional do equipamento
--
-- O formulário de diagnóstico pede que o técnico classifique a condição
-- física do aparelho: Crítica, Alerta ou Ótimo. Até aqui só havia campo de
-- texto livre (`diagnosis`), o que não permite filtrar nem relatar.
--
-- Não confundir com `service_ratings.equipment_condition`: aquele é a
-- percepção do CLIENTE depois do atendimento; este é o laudo do TÉCNICO
-- durante a execução. São coisas diferentes, preenchidas por pessoas
-- diferentes, em momentos diferentes.
-- =====================================================================

do $$ begin
  create type public.equipment_condition_level as enum ('critica', 'alerta', 'otimo');
exception when duplicate_object then null;
end $$;

alter table public.service_calls
  add column if not exists equipment_condition public.equipment_condition_level;

comment on column public.service_calls.equipment_condition is
  'Laudo do técnico sobre a condição física do equipamento no atendimento.';

-- Relatório por condição: a leitura útil é "quantos críticos no período".
create index if not exists service_calls_equipment_condition_idx
  on public.service_calls (equipment_condition)
  where equipment_condition is not null;

-- ---------------------------------------------------------------------
-- O técnico passa a gravar a condição junto com o diagnóstico
--
-- A assinatura antiga precisa CAIR antes de criar a nova. Se as duas
-- coexistissem, uma chamada com cinco argumentos ficaria ambígua entre
-- elas e o Postgres recusaria com "function is not unique".
-- ---------------------------------------------------------------------
drop function if exists public.technician_update_service_call(uuid, text, text, text, text);

create or replace function public.technician_update_service_call(
  p_call_id uuid,
  p_title text default null,
  p_description text default null,
  p_diagnosis text default null,
  p_solution text default null,
  p_equipment_condition public.equipment_condition_level default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.service_calls
     where id = p_call_id and technician_id = public.my_technician_id()
  ) then
    raise exception 'Chamado não está atribuído ao técnico autenticado';
  end if;

  if exists (
    select 1 from public.service_calls
     where id = p_call_id and status in ('finalizado', 'cancelado')
  ) then
    raise exception 'Chamado encerrado não pode ser ajustado';
  end if;

  -- coalesce em todos os campos: o app envia a tela inteira, e null aqui
  -- significa "não mexer", nunca "apagar o que já estava lá".
  update public.service_calls set
    title               = coalesce(nullif(trim(p_title), ''), title),
    description         = coalesce(p_description, description),
    diagnosis           = coalesce(p_diagnosis, diagnosis),
    solution            = coalesce(p_solution, solution),
    equipment_condition = coalesce(p_equipment_condition, equipment_condition)
  where id = p_call_id;
end;
$$;

revoke all on function public.technician_update_service_call(
  uuid, text, text, text, text, public.equipment_condition_level
) from public, anon;

grant execute on function public.technician_update_service_call(
  uuid, text, text, text, text, public.equipment_condition_level
) to authenticated;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_calls'
      and column_name = 'equipment_condition') as coluna_criada,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'technician_update_service_call') as funcoes_com_esse_nome;
