-- =====================================================================
-- JEmpreendimentos — Distribuição automática de chamados
--
-- A pontuação de técnicos já existia (distribute_service_call), mas só
-- rodava quando o administrador abria a tela e acionava chamado por
-- chamado. O briefing pede o contrário: delegar sem intervenção manual
-- constante. Aqui o chamado nasce e já sai atribuído.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Interruptor: dá para voltar ao modo manual sem mexer em código
-- ---------------------------------------------------------------------
alter table public.service_distribution_settings
  add column if not exists auto_distribute boolean not null default true;

comment on column public.service_distribution_settings.auto_distribute is
  'Quando verdadeiro, todo chamado aberto é atribuído automaticamente ao técnico mais bem pontuado.';

-- ---------------------------------------------------------------------
-- Gatilho
--
-- Chama a função interna, e NÃO o wrapper admin: quem distribui aqui é o
-- próprio sistema, não uma pessoa — exigir is_admin() faria a abertura de
-- chamado pelo cliente falhar.
-- ---------------------------------------------------------------------
create or replace function public.auto_distribute_service_call()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_auto boolean;
begin
  -- Só chamados que nascem abertos e sem técnico entram na fila automática.
  if new.technician_id is not null or new.status <> 'aberto' then
    return new;
  end if;

  select auto_distribute into v_auto
    from public.service_distribution_settings
   where singleton
   limit 1;

  if coalesce(v_auto, false) is not true then
    return new;
  end if;

  -- A distribuição é um ganho, não um requisito: se ela falhar (nenhum
  -- técnico elegível, configuração incompleta, erro de cálculo), o chamado
  -- precisa continuar existindo para alguém atribuir na mão. Por isso o
  -- erro é engolido de propósito.
  begin
    perform public.distribute_service_call(new.id);
  exception
    when others then
      raise warning 'Distribuição automática falhou para o chamado %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists service_calls_auto_distribute on public.service_calls;
create trigger service_calls_auto_distribute
  after insert on public.service_calls
  for each row execute function public.auto_distribute_service_call();

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select
  (select auto_distribute from public.service_distribution_settings where singleton limit 1)
    as distribuicao_automatica,
  (select count(*) from pg_trigger where tgname = 'service_calls_auto_distribute')
    as gatilho_instalado;
