-- ---------------------------------------------------------------------
-- 0033 — Parar de perder o motivo das falhas
--
-- Ao abrir um chamado, duas coisas deveriam acontecer sozinhas: avisar a
-- administração e distribuir para um técnico. Desde o chamado #2854 nenhuma
-- das duas acontece — e o chamado nasce normalmente, sem nada na tela
-- dizendo o que deu errado.
--
-- O motivo de ninguém saber o porquê é que os dois gatilhos terminam em
-- `raise warning`. Isso foi decisão consciente e continua certa: distribuir
-- e avisar são ganhos, e nenhum dos dois pode impedir o chamado de existir.
-- O erro estava em mandar o motivo para um log que ninguém lê.
--
-- Chamar `notificar_evento` na mão funciona, o gatilho existe, há
-- administrador cadastrado e o evento é crítico. Ou seja: a falha só
-- aparece no caminho real, executado por quem abre o chamado. Sem o texto
-- do erro, o que resta é adivinhar — e adivinhar já custou duas rodadas de
-- teste no push.
-- ---------------------------------------------------------------------

create table if not exists public.falhas_de_gatilho (
  id          bigint generated always as identity primary key,
  quando      timestamptz not null default now(),
  gatilho     text not null,
  entidade    uuid,
  erro        text not null,
  detalhe     text,
  -- Quem estava executando. É a peça que falta para explicar por que o
  -- mesmo código funciona no SQL Editor e falha no aplicativo.
  quem        uuid default auth.uid(),
  papel       text default current_user
);
create index if not exists falhas_quando_idx on public.falhas_de_gatilho (quando desc);

alter table public.falhas_de_gatilho enable row level security;

drop policy if exists falhas_admin on public.falhas_de_gatilho;
create policy falhas_admin on public.falhas_de_gatilho
  for select using (public.is_admin());

/**
 * Registra a falha sem nunca atrapalhar quem a sofreu.
 *
 * O `exception when others then null` de dentro não é descuido: se gravar o
 * diagnóstico falhasse, derrubaria a operação que o diagnóstico existe para
 * proteger.
 */
create or replace function public.registrar_falha(
  p_gatilho text,
  p_entidade uuid,
  p_erro text,
  p_detalhe text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.falhas_de_gatilho (gatilho, entidade, erro, detalhe)
    values (p_gatilho, p_entidade, p_erro, p_detalhe);
  exception when others then
    null;
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- Os dois gatilhos passam a deixar rastro
-- ---------------------------------------------------------------------
create or replace function public.tg_notificar_chamado_criado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notificar_evento(
    case when new.priority = 'urgente' then 'TICKET_URGENT' else 'NEW_TICKET' end,
    'chamado', new.id, '{}');
  return new;
exception when others then
  -- Notificação nunca pode derrubar a operação que a originou. Mas o motivo
  -- agora fica gravado, em vez de sumir num warning.
  perform public.registrar_falha('novo_chamado', new.id, sqlerrm, sqlstate);
  raise warning 'Notificação de novo chamado falhou (%): %', new.id, sqlerrm;
  return new;
end;
$$;

create or replace function public.tg_notificar_chamado_atualizado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.technician_id is distinct from old.technician_id and new.technician_id is not null then
    perform public.notificar_evento('TICKET_ASSIGNED', 'chamado', new.id, '{}');
  end if;

  if new.status is distinct from old.status then
    perform public.notificar_evento(
      case new.status
        when 'tecnico_atribuido'    then 'TICKET_ACCEPTED'
        when 'a_caminho'            then 'TICKET_EN_ROUTE'
        when 'em_atendimento'       then 'TICKET_STARTED'
        when 'finalizado'           then 'TICKET_FINISHED'
        when 'cancelado'            then 'TICKET_CANCELLED'
        when 'aguardando_peca'      then 'TICKET_WAITING_PART'
        when 'aguardando_aprovacao' then 'TICKET_WAITING_APPROVAL'
        else null
      end,
      'chamado', new.id, '{}');
  end if;

  return new;
exception when others then
  perform public.registrar_falha('chamado_atualizado', new.id, sqlerrm, sqlstate);
  raise warning 'Notificação de atualização falhou (%): %', new.id, sqlerrm;
  return new;
end;
$$;

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
    perform public.registrar_falha('distribuicao', new.id,
      'distribuição automática desligada nas configurações', null);
    return new;
  end if;

  -- A distribuição é um ganho, não um requisito: se ela falhar (nenhum
  -- técnico elegível, configuração incompleta, erro de cálculo), o chamado
  -- precisa continuar existindo para alguém atribuir na mão. Por isso o
  -- erro é engolido — mas agora fica gravado.
  begin
    perform public.distribute_service_call(new.id);
  exception
    when others then
      perform public.registrar_falha('distribuicao', new.id, sqlerrm, sqlstate);
      raise warning 'Distribuição automática falhou para o chamado %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'falhas_de_gatilho')   as tabela_deve_ser_1,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'registrar_falha')         as funcao_deve_ser_1;
