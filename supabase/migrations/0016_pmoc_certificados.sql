-- =====================================================================
-- JEmpreendimentos — PMOC: execuções e certificados
--
-- O PMOC precisa comprovar à vigilância sanitária QUE rotina foi feita,
-- QUANDO e POR QUEM. As tabelas atuais só guardavam a última execução
-- (pmoc_items.last_execution), o que não sustenta um certificado de
-- período. Aqui entra o histórico e o documento numerado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Execuções: uma linha por rotina executada
-- ---------------------------------------------------------------------
create table if not exists public.pmoc_executions (
  id             uuid primary key default gen_random_uuid(),
  pmoc_item_id   uuid not null references public.pmoc_items(id) on delete cascade,
  technician_id  uuid references public.technicians(id) on delete set null,
  executed_at    timestamptz not null default now(),
  conforme       boolean not null default true,   -- rotina dentro do esperado?
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists pmoc_exec_item_idx on public.pmoc_executions (pmoc_item_id, executed_at desc);
create index if not exists pmoc_exec_data_idx on public.pmoc_executions (executed_at desc);

-- Registrar execução atualiza o item: última e próxima data.
create or replace function public.apply_pmoc_execution()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.pmoc_items
     set last_execution = new.executed_at::date,
         next_execution = (new.executed_at::date + (frequency_months || ' months')::interval)::date
   where id = new.pmoc_item_id;
  return new;
end;
$$;

drop trigger if exists pmoc_executions_apply on public.pmoc_executions;
create trigger pmoc_executions_apply after insert on public.pmoc_executions
  for each row execute function public.apply_pmoc_execution();

-- ---------------------------------------------------------------------
-- Certificados: documento numerado por plano e período
-- ---------------------------------------------------------------------
create sequence if not exists public.pmoc_certificate_seq start 1;

create table if not exists public.pmoc_certificates (
  id             uuid primary key default gen_random_uuid(),
  pmoc_id        uuid not null references public.pmoc(id) on delete cascade,
  number         text not null unique,
  period_start   date not null,
  period_end     date not null,
  -- Responsável técnico: exigência da fiscalização, guardado no próprio
  -- documento para o certificado continuar válido mesmo que o cadastro mude.
  responsible_name      text not null,
  responsible_registration text,
  signer_name    text,
  signature_path text,
  storage_path   text,
  issued_by      uuid references public.profiles(id) on delete set null,
  issued_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists pmoc_cert_pmoc_idx on public.pmoc_certificates (pmoc_id, issued_at desc);

-- Numeração legível e sequencial: PMOC-2026-000001
create or replace function public.next_pmoc_certificate_number()
returns text
language sql volatile security definer set search_path = public
as $$
  select 'PMOC-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.pmoc_certificate_seq')::text, 6, '0')
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.pmoc_executions   enable row level security;
alter table public.pmoc_certificates enable row level security;

drop policy if exists pmoc_exec_read on public.pmoc_executions;
create policy pmoc_exec_read on public.pmoc_executions
  for select using (
    exists (
      select 1 from public.pmoc_items i
        join public.pmoc p on p.id = i.pmoc_id
       where i.id = pmoc_executions.pmoc_item_id
         and (public.is_admin()
              or p.client_id = public.my_client_id()
              or p.responsible_id = public.my_technician_id())
    )
  );

-- Quem executa é a equipe interna.
drop policy if exists pmoc_exec_write on public.pmoc_executions;
create policy pmoc_exec_write on public.pmoc_executions
  for insert with check (
    public.is_admin() or public.my_technician_id() is not null
  );

drop policy if exists pmoc_cert_read on public.pmoc_certificates;
create policy pmoc_cert_read on public.pmoc_certificates
  for select using (
    exists (
      select 1 from public.pmoc p
       where p.id = pmoc_certificates.pmoc_id
         and (public.is_admin()
              or p.client_id = public.my_client_id()
              or p.responsible_id = public.my_technician_id())
    )
  );

-- Emitir certificado é ato do administrador.
drop policy if exists pmoc_cert_write on public.pmoc_certificates;
create policy pmoc_cert_write on public.pmoc_certificates
  for insert with check (public.is_admin());

grant execute on function public.next_pmoc_certificate_number() to authenticated;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select 'pmoc_executions'   as tabela, count(*) as linhas from public.pmoc_executions
union all
select 'pmoc_certificates', count(*) from public.pmoc_certificates;
