-- ---------------------------------------------------------------------
-- 0031 — PMOC conforme o modelo da norma
--
-- O plano já existia desde a 0001 e funciona, mas cada rotina era um texto
-- digitado à mão em `pmoc_items.routine`. Na prática isso significa que dois
-- planos da mesma empresa saem diferentes e nenhum bate exatamente com o
-- documento que a fiscalização espera ver.
--
-- Esta migração traz o modelo para dentro do banco:
--
--   1. O catálogo das 44 rotinas, em 12 grupos, com a periodicidade de cada
--      uma — o miolo da seção 5 do PMOC.
--   2. Periodicidade em letra (Q/M/B/T/S/A) em vez de meses inteiros.
--      `frequency_months` não conseguia representar QUINZENAL, que está na
--      legenda da norma: meio mês não cabe num inteiro.
--   3. Os ambientes climatizados da seção 4, com ocupantes, área e carga
--      térmica — campos que não tinham onde morar.
--   4. ART/TRT e registro no conselho, da seção 3.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) Periodicidade da norma
--
-- Quinzenal é o motivo de isto existir. O resto poderia continuar em meses,
-- mas misturar duas unidades no mesmo campo é como o erro entra.
-- ---------------------------------------------------------------------
create or replace function public.intervalo_da_periodicidade(p_codigo text)
returns interval
language sql
immutable
as $$
  select case upper(coalesce(p_codigo, 'T'))
           when 'Q' then interval '15 days'
           when 'M' then interval '1 month'
           when 'B' then interval '2 months'
           when 'T' then interval '3 months'
           when 'S' then interval '6 months'
           when 'A' then interval '12 months'
           else interval '3 months'
         end
$$;

comment on function public.intervalo_da_periodicidade(text) is
  'Q quinzenal, M mensal, B bimestral, T trimestral, S semestral, A anual.';

-- ---------------------------------------------------------------------
-- 2) Catálogo das rotinas
--
-- Tabela de referência, igual para todos os clientes: é o texto da norma,
-- não uma preferência da empresa. Por isso qualquer pessoa autenticada lê e
-- ninguém escreve pelo aplicativo — mudar isto é mudar o documento legal.
-- ---------------------------------------------------------------------
create table if not exists public.pmoc_routine_catalog (
  code           text primary key,
  grupo          smallint not null,
  grupo_nome     text not null,
  descricao      text not null,
  periodicidade  text not null check (periodicidade in ('Q', 'M', 'B', 'T', 'S', 'A')),
  ordem          smallint not null
);

alter table public.pmoc_routine_catalog enable row level security;

drop policy if exists pmoc_catalog_read on public.pmoc_routine_catalog;
create policy pmoc_catalog_read on public.pmoc_routine_catalog
  for select using (auth.uid() is not null);

insert into public.pmoc_routine_catalog (code, grupo, grupo_nome, descricao, periodicidade, ordem) values
  ('1.1',  1, 'FILTROS DE AR', 'Limpar o elemento filtrante ou substituir em casos de avarias', 'M', 1),
  ('1.2',  1, 'FILTROS DE AR', 'Verificar danos e corrosão do suporte e existência de frestas', 'S', 2),
  ('1.3',  1, 'FILTROS DE AR', 'Verificar e corrigir o ajuste da moldura do filtro na estrutura', 'M', 3),

  ('2.1',  2, 'BANDEJAS', 'Verificar a operação de drenagem do condensado da bandeja', 'M', 4),
  ('2.2',  2, 'BANDEJAS', 'Lavar e remover biofilme com produto biodegradável', 'S', 5),
  ('2.3',  2, 'BANDEJAS', 'Verificar danos e corrosão', 'S', 6),
  ('2.4',  2, 'BANDEJAS', 'Verificar vazamentos e corrigir, se necessário', 'M', 7),

  ('3.1',  3, 'EVAPORADORES', 'Lavar e remover biofilme com produto biodegradável', 'S', 8),
  ('3.2',  3, 'EVAPORADORES', 'Verificar a existência de danos e corrosão no aletado e moldura', 'S', 9),

  ('4.1',  4, 'GABINETES', 'Lavar externamente', 'S', 10),
  ('4.2',  4, 'GABINETES', 'Lavar internamente', 'S', 11),
  ('4.3',  4, 'GABINETES', 'Verificar e eliminar danos e corrosão', 'S', 12),
  ('4.4',  4, 'GABINETES', 'Verificar a vedação dos painéis de fechamento, fixação e danos, substituindo, se necessário', 'S', 13),
  ('4.5',  4, 'GABINETES', 'Verificar o estado de conservação do isolamento termoacústico e substituir na existência do bolor', 'S', 14),
  ('4.6',  4, 'GABINETES', 'Verificar e eliminar ruídos anormais e/ou vibrações', 'S', 15),
  ('4.7',  4, 'GABINETES', 'Verificar o mecanismo de renovação de ar', 'S', 16),
  ('4.8',  4, 'GABINETES', 'Verificar botoeiras, knobs, etc. e repor, se necessário', 'S', 17),
  ('4.9',  4, 'GABINETES', 'Verificar atuação do termostato e chave seletora', 'S', 18),

  ('5.1',  5, 'CONDENSADORES', 'Lavar e remover incrustações', 'S', 19),
  ('5.2',  5, 'CONDENSADORES', 'Verificar a existência de danos e corrosão no aletado e moldura', 'S', 20),

  ('6.1',  6, 'VENTILADORES', 'Verificar e eliminar sujeira, danos e corrosão', 'S', 21),
  ('6.2',  6, 'VENTILADORES', 'Verificar fixação e amortecedores de vibração', 'S', 22),
  ('6.3',  6, 'VENTILADORES', 'Verificar ruído dos manuais e lubrificar, se necessário', 'S', 23),

  ('7.1',  7, 'MOTORES ELÉTRICOS', 'Verificar e corrigir fixação e amortecedores de vibração', 'S', 24),
  ('7.2',  7, 'MOTORES ELÉTRICOS', 'Limpar e verificar danos e corrosão', 'S', 25),
  ('7.3',  7, 'MOTORES ELÉTRICOS', 'Verificar o aterramento', 'S', 26),

  ('8.1',  8, 'COMPRESSORES', 'Verificar e eliminar sujeiras, danos e corrosão', 'S', 27),
  ('8.2',  8, 'COMPRESSORES', 'Verificar fixação e vibrações ou ruídos anormais', 'S', 28),
  ('8.3',  8, 'COMPRESSORES', 'Verificar o aterramento', 'S', 29),

  ('9.1',  9, 'CIRCUITO REFRIGERANTE', 'Verificar e corrigir fixação, danos e corrosão das tubulações', 'S', 30),
  ('9.2',  9, 'CIRCUITO REFRIGERANTE', 'Verificar isolamento térmico e substituir, se necessário', 'S', 31),
  ('9.3',  9, 'CIRCUITO REFRIGERANTE', 'Verificar e corrigir vazamento de gás, se necessário', 'S', 32),

  ('10.1', 10, 'MEDIÇÕES (preenchimento de relatório técnico)', 'Tensão, comparar com a nominal', 'S', 33),
  ('10.2', 10, 'MEDIÇÕES (preenchimento de relatório técnico)', 'Corrente, comparar com a nominal', 'S', 34),
  ('10.3', 10, 'MEDIÇÕES (preenchimento de relatório técnico)', 'Vazões de ar', 'S', 35),
  ('10.4', 10, 'MEDIÇÕES (preenchimento de relatório técnico)', 'Temperatura de retorno do ar', 'S', 36),
  ('10.5', 10, 'MEDIÇÕES (preenchimento de relatório técnico)', 'Temperatura de insuflamento', 'S', 37),
  ('10.6', 10, 'MEDIÇÕES (preenchimento de relatório técnico)', 'Isolamento entre fases e para carcaça do compressor e motor ventilador', 'S', 38),

  ('11.1', 11, 'CIRCUITO ELÉTRICO', 'Verificar disjuntores, tomadas, plugs e rabichos', 'S', 39),
  ('11.2', 11, 'CIRCUITO ELÉTRICO', 'Verificar todos os contatos (terminais) elétricos, quanto ao aperto e corrosão', 'S', 40),

  ('12.1', 12, 'APARELHO / UNIDADE EVAPORADORA', 'Remover e transportar até oficina para abertura, verificação, limpeza e revisão geral de todo o conjunto', 'S', 41),
  ('12.2', 12, 'APARELHO / UNIDADE EVAPORADORA', 'Tratamento anticorrosivo da base do chassi e demais componentes necessários', 'S', 42),
  ('12.3', 12, 'APARELHO / UNIDADE EVAPORADORA', 'Lubrificação e ajustes', 'S', 43),
  ('12.4', 12, 'APARELHO / UNIDADE EVAPORADORA', 'Testes e medições em bancada', 'S', 44)
on conflict (code) do update
  set grupo         = excluded.grupo,
      grupo_nome    = excluded.grupo_nome,
      descricao     = excluded.descricao,
      periodicidade = excluded.periodicidade,
      ordem         = excluded.ordem;

-- ---------------------------------------------------------------------
-- 3) A rotina do plano passa a apontar para o catálogo
--
-- `routine` continua existindo e continua aceitando texto livre: a própria
-- norma manda executar o que o manual do fabricante pedir, mesmo fora desta
-- lista. O catálogo é o padrão, não a camisa de força.
-- ---------------------------------------------------------------------
alter table public.pmoc_items
  add column if not exists catalog_code  text references public.pmoc_routine_catalog(code),
  add column if not exists periodicidade text check (periodicidade in ('Q', 'M', 'B', 'T', 'S', 'A'));

create index if not exists pmoc_items_catalogo_idx on public.pmoc_items (pmoc_id, catalog_code);

-- A execução passa a respeitar a letra quando ela existe. Sem isto, uma
-- rotina quinzenal seria reagendada em meses e o plano mentiria.
create or replace function public.apply_pmoc_execution()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.pmoc_items
     set last_execution = new.executed_at::date,
         next_execution = (
           new.executed_at::date
           + case
               when periodicidade is not null
                 then public.intervalo_da_periodicidade(periodicidade)
               else (frequency_months || ' months')::interval
             end
         )::date
   where id = new.pmoc_item_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Seção 4 — relação dos ambientes climatizados
--
-- Ocupantes, área e carga térmica não são propriedade do equipamento: são
-- do ambiente. Uma sala com dois splits tem uma área e uma carga térmica, e
-- não duas.
-- ---------------------------------------------------------------------
create table if not exists public.pmoc_environments (
  id                  uuid primary key default gen_random_uuid(),
  pmoc_id             uuid not null references public.pmoc(id) on delete cascade,
  activity            text not null default 'Manutenção',
  name                text not null,
  occupants_fixed     integer not null default 0 check (occupants_fixed >= 0),
  occupants_floating  integer not null default 0 check (occupants_floating >= 0),
  area_m2             numeric(10, 2) check (area_m2 is null or area_m2 > 0),
  thermal_load_btu    numeric(12, 0) check (thermal_load_btu is null or thermal_load_btu > 0),
  ordem               smallint not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists pmoc_env_plano_idx on public.pmoc_environments (pmoc_id, ordem);

alter table public.pmoc_environments enable row level security;

drop policy if exists pmoc_env_read on public.pmoc_environments;
create policy pmoc_env_read on public.pmoc_environments
  for select using (
    exists (select 1 from public.pmoc p
             where p.id = pmoc_environments.pmoc_id
               and (public.is_admin() or p.client_id = public.my_client_id()))
  );

drop policy if exists pmoc_env_admin_write on public.pmoc_environments;
create policy pmoc_env_admin_write on public.pmoc_environments
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5) Seção 3 — responsável técnico
--
-- ART/TRT e prazo ficam no plano porque são do contrato, e mudam a cada
-- renovação. O registro no conselho fica no técnico: é dele, não do
-- contrato, e repetir por plano garantiria divergência.
-- ---------------------------------------------------------------------
alter table public.pmoc
  add column if not exists art_trt        text,
  add column if not exists contract_term  text;

alter table public.technicians
  add column if not exists council_registration text;

-- ---------------------------------------------------------------------
-- 6) Aplicar o catálogo a um equipamento do plano
--
-- Cria de uma vez as 44 rotinas para o equipamento indicado. Repetir não
-- duplica: o par (item do plano, código do catálogo) é único.
-- ---------------------------------------------------------------------
create unique index if not exists pmoc_items_unico_catalogo_idx
  on public.pmoc_items (pmoc_id, equipment_id, catalog_code)
  where catalog_code is not null;

create or replace function public.aplicar_catalogo_pmoc(p_pmoc uuid, p_equipment uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_criadas integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Somente a administração monta o plano';
  end if;

  insert into public.pmoc_items
    (pmoc_id, equipment_id, routine, catalog_code, periodicidade, frequency_months, next_execution)
  select
    p_pmoc,
    p_equipment,
    c.code || ' ' || c.descricao,
    c.code,
    c.periodicidade,
    -- Mantido para quem ainda lê meses. Quinzenal arredonda para 1: o campo
    -- não representa meio mês, e é `periodicidade` que manda no reagendamento.
    greatest(1, round(extract(epoch from public.intervalo_da_periodicidade(c.periodicidade)) / 2592000)::int),
    (current_date + public.intervalo_da_periodicidade(c.periodicidade))::date
  from public.pmoc_routine_catalog c
  order by c.ordem
  on conflict do nothing;

  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

revoke all on function public.aplicar_catalogo_pmoc(uuid, uuid) from public, anon;
grant execute on function public.aplicar_catalogo_pmoc(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from public.pmoc_routine_catalog)                      as rotinas_deve_ser_44,
  (select count(distinct grupo) from public.pmoc_routine_catalog)         as grupos_deve_ser_12,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'pmoc_environments')   as tabela_deve_ser_1,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'pmoc_items'
      and column_name in ('catalog_code', 'periodicidade'))               as colunas_deve_ser_2;
