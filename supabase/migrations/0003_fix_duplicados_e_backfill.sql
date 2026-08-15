-- =====================================================================
-- JEmpreendimentos — Correção pós-primeira aplicação
--
-- Rode UMA VEZ, depois de já ter aplicado 0001 + 0002.
-- É seguro rodar mais de uma vez (tudo aqui é idempotente).
--
-- Resolve:
--   1. Checklists duplicados por execução repetida do seed
--   2. Usuários que se cadastraram antes do trigger existir e ficaram sem profile
--   3. Garante o catálogo de peças e o estoque inicial
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Remove checklists duplicados
--    Mantém, de cada nome, o registro de menor id. Os itens saem junto
--    pelo on delete cascade.
-- ---------------------------------------------------------------------
delete from public.checklists c
using public.checklists manter
where manter.name = c.name
  and manter.id < c.id;

-- Impede que aconteça de novo.
create unique index if not exists checklists_name_uidx on public.checklists (name);

-- ---------------------------------------------------------------------
-- 2. Cria o profile de quem se cadastrou antes do trigger existir
-- ---------------------------------------------------------------------
insert into public.profiles (id, email, full_name, role)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       coalesce((u.raw_user_meta_data ->> 'role')::public.user_role, 'cliente')
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------
-- 3. Garante peças e estoque inicial (idempotente por SKU)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('GAS-R410A', 'Gás refrigerante R-410A',        'kg', 10::numeric, 3::numeric),
      ('GAS-R32',   'Gás refrigerante R-32',          'kg',  8,          3),
      ('FIL-STD',   'Filtro de ar padrão',            'un', 24,          8),
      ('CAP-35UF',  'Capacitor 35uF',                 'un',  6,          4),
      ('CAP-45UF',  'Capacitor 45uF',                 'un',  4,          4),
      ('SUP-SPLIT', 'Suporte para condensadora split','un', 12,          4),
      ('TUB-1-4',   'Tubulação de cobre 1/4"',        'm',  30,         10),
      ('TUB-3-8',   'Tubulação de cobre 3/8"',        'm',  25,         10),
      ('DRE-20MM',  'Mangueira de dreno 20mm',        'm',  40,         15),
      ('PLA-UNIV',  'Placa eletrônica universal',     'un',  2,          2)
    ) as t(sku, name, unit, qty, minq)
  loop
    insert into public.parts (sku, name, unit) values (r.sku, r.name, r.unit)
    on conflict (sku) do nothing;

    insert into public.inventory (part_id, quantity, min_quantity, location)
    select id, r.qty, r.minq, 'Estoque central' from public.parts where sku = r.sku
    on conflict (part_id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Conferência — o resultado esperado está na coluna "esperado"
-- ---------------------------------------------------------------------
select 'checklists'      as tabela, count(*) as atual, 3  as esperado from public.checklists
union all
select 'checklist_items', count(*), 29 from public.checklist_items
union all
select 'parts',           count(*), 10 from public.parts
union all
select 'inventory',       count(*), 10 from public.inventory
union all
select 'profiles',        count(*), (select count(*) from auth.users)::int from public.profiles;
