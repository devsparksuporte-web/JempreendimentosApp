-- ---------------------------------------------------------------------
-- 0030 — Financeiro: contrato, fatura e resposta do cliente ao orçamento
--
-- Boa parte já existia desde a 0001 e nunca foi usada: `quotations`,
-- `quotation_items` e `financial_entries` estão lá, com RLS, sem uma linha
-- de código as tocando. Esta migração não as reinventa. Ela fecha três
-- buracos que impedem o ciclo de cobrança de fechar:
--
--   1. Não há contrato mensal. A JEmpreendimentos cobra PMOC por mês, e não
--      havia onde guardar valor, dia de vencimento e vigência.
--   2. O cliente não enxerga a própria fatura. `financial_entries` é
--      `for all using (is_admin())` — quem deve não vê o que deve.
--   3. O cliente não pode responder ao orçamento. Ele lê, mas a escrita é
--      só do administrador, então "aprovar pelo aplicativo" era impossível.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) Contrato de manutenção
--
-- `billing_day` é o dia do mês em que a fatura nasce. Dia 31 em mês curto é
-- resolvido na geração, não aqui: a regra é de calendário, não de tabela.
-- ---------------------------------------------------------------------
create table if not exists public.service_contracts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  description  text not null default 'Contrato de manutenção PMOC',
  amount       numeric(12, 2) not null check (amount >= 0),
  billing_day  smallint not null default 5 check (billing_day between 1 and 31),
  starts_on    date not null default current_date,
  ends_on      date,
  active       boolean not null default true,
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists service_contracts_client_idx
  on public.service_contracts (client_id, starts_on desc);
create index if not exists service_contracts_ativos_idx
  on public.service_contracts (active) where active;

drop trigger if exists service_contracts_touch on public.service_contracts;
create trigger service_contracts_touch before update on public.service_contracts
  for each row execute function public.touch_updated_at();

alter table public.service_contracts enable row level security;

-- O cliente vê o próprio contrato: é ele que assina e paga.
drop policy if exists service_contracts_read on public.service_contracts;
create policy service_contracts_read on public.service_contracts
  for select using (public.is_admin() or client_id = public.my_client_id());

drop policy if exists service_contracts_admin_write on public.service_contracts;
create policy service_contracts_admin_write on public.service_contracts
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2) O cliente enxerga a própria conta
--
-- A política antiga era `for all using (is_admin())`, o que também barrava a
-- leitura. Cobrar alguém que não consegue ver o que deve gera ligação para o
-- escritório — e é o tipo de coisa que o aplicativo existe para evitar.
--
-- Só as contas A RECEBER dele. Despesa da empresa não é assunto do cliente,
-- e `type = 'pagar'` continua invisível fora da administração.
--
-- Escrita segue exclusiva da administração: quem deve não dá baixa no que
-- deve.
-- ---------------------------------------------------------------------
drop policy if exists financial_admin on public.financial_entries;

drop policy if exists financial_read on public.financial_entries;
create policy financial_read on public.financial_entries
  for select using (
    public.is_admin()
    or (type = 'receber' and client_id = public.my_client_id())
  );

drop policy if exists financial_admin_write on public.financial_entries;
create policy financial_admin_write on public.financial_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3) Faturas do mês
--
-- Pode rodar quantas vezes quiser: o índice único impede a segunda fatura do
-- mesmo contrato no mesmo mês. Sem ele, dois toques no botão cobrariam o
-- cliente duas vezes — e ele descobriria isso pelo extrato.
-- ---------------------------------------------------------------------
-- A fatura passa a apontar para o contrato que a originou. Sem isso, a
-- única chave possível seria (cliente, mês) — e um cliente com duas
-- unidades, logo dois contratos, teria a segunda fatura descartada em
-- silêncio pelo índice.
alter table public.financial_entries
  add column if not exists contract_id uuid references public.service_contracts(id) on delete set null;

create unique index if not exists financial_contrato_mes_idx
  on public.financial_entries (contract_id, due_date)
  where contract_id is not null;

create or replace function public.gerar_faturas_do_mes(p_referencia date default current_date)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_contrato record;
  v_vence    date;
  v_criadas  integer := 0;
  v_primeiro date := date_trunc('month', p_referencia)::date;
  v_ultimo   date := (date_trunc('month', p_referencia) + interval '1 month - 1 day')::date;
begin
  if not public.is_admin() then
    raise exception 'Somente a administração gera faturas';
  end if;

  for v_contrato in
    select * from public.service_contracts
     where active
       and starts_on <= v_ultimo
       and (ends_on is null or ends_on >= v_primeiro)
  loop
    -- Dia 31 em mês curto cai no último dia, não no mês seguinte.
    v_vence := least(
      (v_primeiro + (v_contrato.billing_day - 1) * interval '1 day')::date,
      v_ultimo);

    insert into public.financial_entries
      (type, status, description, category, amount, due_date, client_id, contract_id, created_by)
    values
      ('receber'::public.financial_type,
       'pendente'::public.financial_status,
       v_contrato.description || ' — ' || to_char(v_primeiro, 'MM/YYYY'),
       'contrato',
       v_contrato.amount,
       v_vence,
       v_contrato.client_id,
       v_contrato.id,
       auth.uid())
    on conflict do nothing;

    if found then
      v_criadas := v_criadas + 1;
    end if;
  end loop;

  return v_criadas;
end;
$$;

revoke all on function public.gerar_faturas_do_mes(date) from public, anon;
grant execute on function public.gerar_faturas_do_mes(date) to authenticated;

-- ---------------------------------------------------------------------
-- 4) O cliente responde ao orçamento
--
-- Não vira política de escrita na tabela: solto, o cliente poderia alterar o
-- total, a validade e os itens do próprio orçamento. A função permite
-- exatamente uma transição — de 'enviado' para 'aprovado' ou 'recusado' — e
-- só no orçamento dele.
-- ---------------------------------------------------------------------
create or replace function public.responder_orcamento(
  p_quotation uuid,
  p_aprovado boolean,
  p_observacao text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_orcamento public.quotations%rowtype;
begin
  select * into v_orcamento from public.quotations where id = p_quotation;
  if not found then
    raise exception 'Orçamento não encontrado';
  end if;

  if v_orcamento.client_id is distinct from public.my_client_id() then
    raise exception 'Este orçamento não é seu';
  end if;

  if v_orcamento.status <> 'enviado' then
    raise exception 'Este orçamento não está aguardando resposta';
  end if;

  if v_orcamento.valid_until is not null and v_orcamento.valid_until < current_date then
    update public.quotations
       set status = 'expirado'::public.quotation_status
     where id = p_quotation;
    raise exception 'Este orçamento expirou em %', to_char(v_orcamento.valid_until, 'DD/MM/YYYY');
  end if;

  update public.quotations
     set status = (case when p_aprovado then 'aprovado' else 'recusado' end)
                  ::public.quotation_status,
         notes  = coalesce(nullif(trim(coalesce(p_observacao, '')), ''), notes)
   where id = p_quotation;

  perform public.notificar_evento(
    case when p_aprovado then 'QUOTE_APPROVED' else 'QUOTE_REJECTED' end,
    'orcamento', p_quotation,
    jsonb_build_object(
      'titulo', case when p_aprovado then 'Orçamento aprovado' else 'Orçamento recusado' end,
      'corpo', 'O cliente respondeu ao orçamento de R$ ' ||
               trim(to_char(v_orcamento.total, 'FM999G999G990D00')) || '.'));
end;
$$;

revoke all on function public.responder_orcamento(uuid, boolean, text) from public, anon;
grant execute on function public.responder_orcamento(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'service_contracts')     as tabela_deve_ser_1,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'financial_entries')        as politicas_deve_ser_2,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('gerar_faturas_do_mes', 'responder_orcamento'))     as funcoes_deve_ser_2;
