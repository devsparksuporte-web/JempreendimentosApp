-- ---------------------------------------------------------------------
-- 0025 — O saldo é aplicado uma vez só
--
-- A 0001 tem um gatilho, `inventory_movements_apply`, que aplica o
-- movimento ao saldo depois de inserido. A 0023 criou
-- `movimentar_estoque`, que já atualiza `inventory` e só então grava o
-- movimento. Os dois ficaram vivos ao mesmo tempo:
--
--   - 'entrada' e 'saida' passaram a ser aplicadas em dobro;
--   - 'recebimento_compra', 'devolucao' e 'uso_tecnico' não existiam
--     quando o gatilho foi escrito, então caíam no `else` dele, que
--     SUBSTITUI o saldo pela quantidade do movimento. Receber 3 num
--     produto com 10 em estoque deixava o saldo em 3.
--
-- O gatilho não pode simplesmente cair: `consume_part_on_service` (0001)
-- ainda insere direto em `inventory_movements` e depende dele para dar a
-- baixa da peça usada no chamado.
--
-- O que separa os dois caminhos é quantity_after: só `movimentar_estoque`
-- o preenche. Quem chega com ele preenchido já teve o saldo atualizado.
-- ---------------------------------------------------------------------

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Veio por movimentar_estoque: o saldo já foi escrito, com trava de
  -- linha, na mesma transação. Aplicar aqui seria contar duas vezes.
  if new.quantity_after is not null then
    return new;
  end if;

  insert into public.inventory (part_id, quantity) values (new.part_id, 0)
  on conflict (part_id) do nothing;

  update public.inventory
     set quantity = case new.type
                      when 'entrada'            then quantity + new.quantity
                      when 'devolucao'          then quantity + new.quantity
                      when 'recebimento_compra' then quantity + new.quantity
                      when 'saida'              then quantity - new.quantity
                      when 'uso_tecnico'        then quantity - new.quantity
                      else new.quantity   -- ajuste: vira o saldo final
                    end,
         updated_at = now()
   where part_id = new.part_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Reconstrói o saldo dos produtos que o gatilho estragou
--
-- Não dá para confiar em quantity_after: o segundo movimento já leu o
-- saldo corrompido pelo primeiro. A única âncora confiável é o último
-- 'ajuste', que é absoluto por definição — dali para frente basta somar.
--
-- Produtos sem nenhum 'ajuste' no histórico ficam de fora: o saldo
-- inicial deles não veio de movimento nenhum, e reconstruir do zero
-- apagaria essa quantidade. A conferência no fim lista esses casos.
-- ---------------------------------------------------------------------
with ancora as (
  select distinct on (part_id) part_id, id, created_at, quantity as saldo
    from public.inventory_movements
   where type = 'ajuste'
   order by part_id, created_at desc, id desc
),
afetados as (
  select distinct part_id
    from public.inventory_movements
   where quantity_after is not null
),
recalculo as (
  select a.part_id,
         a.saldo + coalesce((
           select sum(case m.type
                        when 'entrada'            then  m.quantity
                        when 'devolucao'          then  m.quantity
                        when 'recebimento_compra' then  m.quantity
                        when 'saida'              then -m.quantity
                        when 'uso_tecnico'        then -m.quantity
                        else 0
                      end)
             from public.inventory_movements m
            where m.part_id = a.part_id
              and m.type <> 'ajuste'
              and (m.created_at, m.id) > (a.created_at, a.id)
         ), 0) as saldo
    from ancora a
   where a.part_id in (select part_id from afetados)
)
update public.inventory i
   set quantity = r.saldo, updated_at = now()
  from recalculo r
 where r.part_id = i.part_id
   and i.quantity is distinct from r.saldo;

-- ---------------------------------------------------------------------
-- 3) Conferência
--
-- `sem_ancora` precisa ser 0. Se vier maior, são produtos tocados por
-- movimentar_estoque que nunca tiveram ajuste: o saldo deles pode estar
-- errado e só um ajuste manual, feito por quem contou a prateleira,
-- resolve.
-- ---------------------------------------------------------------------
select
  (select position('quantity_after is not null' in pg_get_functiondef(p.oid)) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_inventory_movement')                as guarda_deve_ser_true,
  (select count(*)
     from (select distinct part_id
             from public.inventory_movements
            where quantity_after is not null) af
    where not exists (select 1 from public.inventory_movements m
                       where m.part_id = af.part_id
                         and m.type = 'ajuste'))                 as sem_ancora_deve_ser_0,
  (select i.quantity from public.inventory i
     join public.parts pa on pa.id = i.part_id
    where pa.sku = 'CAP-45UF')                                   as capacitor_45uf_deve_ser_18;
