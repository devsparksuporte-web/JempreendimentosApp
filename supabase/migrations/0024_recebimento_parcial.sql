-- ---------------------------------------------------------------------
-- 0024 — Recebimento de mercadoria: parcial e com dono
--
-- Dois buracos da 0023 que só aparecem quando a mercadoria chega de
-- verdade:
--
-- 1. Recebimento parcial fechava o pedido. Chegando 5 de 20, o gatilho
--    marcava o pedido como 'recebido' e a solicitação como 'concluido' —
--    as 15 restantes sumiam do radar de quem cobra o fornecedor.
--
-- 2. `movimentar_estoque` é security definer e não perguntava quem
--    chamava. O revoke da 0023 foi de `public` e `anon`, mas o Supabase
--    concede execute a `authenticated` por default privileges — ou seja,
--    qualquer pessoa logada podia mexer no saldo pela API.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1) Quem pode movimentar o saldo
--
-- Administrador sempre. Técnico só para baixar ou devolver material de um
-- chamado que é dele — hoje nenhuma tela faz isso, mas é o único caso
-- legítimo, e deixar a porta descrita evita que ela seja aberta larga
-- depois.
-- ---------------------------------------------------------------------
create or replace function public.movimentar_estoque(
  p_part_id        uuid,
  p_tipo           public.movement_type,
  p_quantidade     numeric,
  p_motivo         text default null,
  p_reference_type text default null,
  p_reference_id   uuid default null,
  p_service_call   uuid default null,
  p_technician     uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_antes  numeric;
  v_depois numeric;
  v_id     uuid;
  v_sinal  integer;
begin
  if not public.is_admin() then
    if p_tipo not in ('uso_tecnico', 'devolucao')
       or p_service_call is null
       or not exists (
         select 1 from public.service_calls sc
          where sc.id = p_service_call
            and sc.technician_id = public.my_technician_id())
    then
      raise exception 'Sem permissão para movimentar o estoque';
    end if;
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade da movimentação precisa ser maior que zero';
  end if;

  -- Trava a linha: duas movimentações simultâneas do mesmo item não podem
  -- ler o mesmo saldo anterior.
  select quantity into v_antes from public.inventory
   where part_id = p_part_id for update;

  if not found then
    insert into public.inventory (part_id, quantity) values (p_part_id, 0);
    v_antes := 0;
  end if;

  v_sinal := case p_tipo
               when 'entrada' then 1
               when 'devolucao' then 1
               when 'recebimento_compra' then 1
               when 'saida' then -1
               when 'uso_tecnico' then -1
               else 0   -- ajuste: a quantidade informada vira o saldo final
             end;

  v_depois := case when v_sinal = 0 then p_quantidade else v_antes + v_sinal * p_quantidade end;

  if v_depois < 0 then
    raise exception 'Saldo insuficiente: % em estoque, saída de %', v_antes, p_quantidade;
  end if;

  update public.inventory
     set quantity = v_depois, updated_at = now()
   where part_id = p_part_id;

  insert into public.inventory_movements
    (part_id, type, quantity, service_call_id, technician_id, note, reason,
     quantity_before, quantity_after, reference_type, reference_id, created_by)
  values
    (p_part_id, p_tipo, p_quantidade, p_service_call, p_technician, p_motivo, p_motivo,
     v_antes, v_depois, p_reference_type, p_reference_id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.movimentar_estoque(
  uuid, public.movement_type, numeric, text, text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Quanto o pedido pediu
--
-- O pedido não tem itens: nasce de uma cotação, que tem a quantidade. Se
-- a cotação sumiu, o próprio recebimento carrega a quantidade pedida.
-- ---------------------------------------------------------------------
create or replace function public.quantidade_do_pedido(p_order_id uuid)
returns numeric
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (select q.quantity
       from public.purchase_orders o
       join public.supplier_quotes q on q.id = o.quote_id
      where o.id = p_order_id),
    (select max(r.quantity_ordered)
       from public.purchase_receipts r
      where r.purchase_order_id = p_order_id),
    0);
$$;

grant execute on function public.quantidade_do_pedido(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Recebimento confirmado dá entrada, e só fecha o pedido quando a
--    quantidade pedida foi inteira
-- ---------------------------------------------------------------------
create or replace function public.tg_recebimento_confirmado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido   public.purchase_orders%rowtype;
  v_pedida   numeric;
  v_recebida numeric;
  v_completo boolean;
begin
  if new.confirmed and (tg_op = 'INSERT' or not old.confirmed) then
    select * into v_pedido from public.purchase_orders where id = new.purchase_order_id;

    perform public.movimentar_estoque(
      new.part_id, 'recebimento_compra', new.quantity_received,
      'Recebimento do pedido ' || coalesce(v_pedido.number, ''),
      'recebimento', new.id);

    v_pedida := coalesce(nullif(public.quantidade_do_pedido(new.purchase_order_id), 0),
                         new.quantity_ordered);

    -- Esta linha ainda não está na tabela num INSERT, e num UPDATE ela
    -- entraria com o valor antigo. Some-se fora, nos dois casos.
    select coalesce(sum(r.quantity_received), 0) into v_recebida
      from public.purchase_receipts r
     where r.purchase_order_id = new.purchase_order_id
       and r.confirmed
       and r.id <> new.id;
    v_recebida := v_recebida + new.quantity_received;

    v_completo := v_recebida >= v_pedida;

    update public.purchase_orders
       set status = case when v_completo then 'recebido' else 'em_transito' end,
           updated_at = now()
     where id = new.purchase_order_id;

    -- Parcial deixa a solicitação em 'recebido': chegou material, mas
    -- ainda há o que cobrar do fornecedor.
    update public.replenishment_requests
       set status = case when v_completo then 'concluido' else 'recebido' end,
           updated_at = now()
     where id = v_pedido.request_id;

    new.confirmed_at := coalesce(new.confirmed_at, now());
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());

    perform public.notificar_evento('PURCHASE_RECEIVED', 'pedido', new.purchase_order_id,
      jsonb_build_object(
        'titulo', case when v_completo then 'Material recebido'
                       else 'Recebimento parcial' end,
        'corpo', 'Entrada de ' || trim(to_char(new.quantity_received, 'FM999990.00')) ||
                 ' no pedido ' || coalesce(v_pedido.number, '') ||
                 case when v_completo then '.'
                      else '. Faltam ' ||
                           trim(to_char(v_pedida - v_recebida, 'FM999990.00')) || '.' end));
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_receipts_confirma on public.purchase_receipts;
create trigger purchase_receipts_confirma
  before insert or update of confirmed on public.purchase_receipts
  for each row execute function public.tg_recebimento_confirmado();

-- ---------------------------------------------------------------------
-- 4) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'quantidade_do_pedido')  as funcao_qtd_deve_ser_1,
  (select count(*) from pg_trigger
    where tgname = 'purchase_receipts_confirma' and not tgisinternal)   as gatilho_deve_ser_1,
  (select position('Sem permissão para movimentar' in pg_get_functiondef(p.oid)) > 0
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'movimentar_estoque')    as guarda_deve_ser_true;
