-- =====================================================================
-- JEmpreendimentos — Estoque inteligente, fornecedores e reposição
--
-- Auditoria feita antes de criar qualquer coisa, como pedido:
--
--   REAPROVEITADO  parts + inventory  ....... produto e saldo
--                  suppliers ................ fornecedor
--                  inventory_movements ...... histórico de movimentação
--                  audit_logs ............... auditoria
--                  notification_events ...... catálogo de eventos (0022)
--
--   NOVO           part_categories .......... categorias
--                  supplier_contacts ........ vários contatos por fornecedor
--                  supplier_products ........ produto x fornecedor
--                  replenishment_requests ... solicitação de reposição
--                  supplier_quotes .......... cotação DO fornecedor
--                  purchase_orders .......... pedido de compra
--                  purchase_receipts ........ recebimento
--                  supplier_communications .. registro de contatos
--
-- `quotations` já existia e NÃO foi reaproveitada de propósito: ela é a
-- cotação PARA O CLIENTE (client_id not null). A cotação do fornecedor é
-- outra coisa, com outro dono e outro ciclo de vida. Nomes parecidos,
-- entidades diferentes.
--
-- Sem `empresa_id`: o banco todo é de uma empresa só, e as 73 políticas
-- existentes assumem isso. Introduzir multiempresa em meia dúzia de tabelas
-- deixaria metade do banco filtrando por empresa e metade não — que é como
-- nasce vazamento de dado entre clientes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Vocabulário
-- ---------------------------------------------------------------------
do $$ begin
  create type public.replenishment_status as enum (
    'rascunho', 'pendente', 'enviado_fornecedor', 'fornecedor_respondeu',
    'em_analise', 'aprovado', 'comprado', 'recebido', 'concluido',
    'cancelado', 'recusado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.purchase_order_status as enum (
    'criado', 'enviado', 'confirmado', 'em_transito', 'recebido', 'cancelado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.supplier_channel as enum ('whatsapp', 'email', 'telefone', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.replenishment_priority as enum ('baixa', 'normal', 'alta', 'urgente');
exception when duplicate_object then null;
end $$;

-- Tipos novos de movimentação. Os três originais (entrada, saida, ajuste)
-- continuam valendo; ninguém reescreve histórico.
alter type public.movement_type add value if not exists 'devolucao';
alter type public.movement_type add value if not exists 'recebimento_compra';
alter type public.movement_type add value if not exists 'uso_tecnico';

-- ---------------------------------------------------------------------
-- 2) Categorias de produto
-- ---------------------------------------------------------------------
create table if not exists public.part_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) Produto: o que faltava em `parts` e `inventory`
-- ---------------------------------------------------------------------
alter table public.parts
  add column if not exists code        text,
  add column if not exists category_id uuid references public.part_categories(id) on delete set null,
  add column if not exists brand       text,
  add column if not exists model       text,
  add column if not exists photo_url   text;

create unique index if not exists parts_code_idx on public.parts (code) where code is not null;

comment on column public.parts.supplier_id is
  'Fornecedor principal. Os demais ficam em supplier_products.';

alter table public.inventory
  add column if not exists max_quantity     numeric(12, 2) not null default 0,
  add column if not exists reorder_quantity numeric(12, 2);

comment on column public.inventory.reorder_quantity is
  'Quantidade fixa de reposição. Nula significa calcular pelo máximo menos o atual.';

-- ---------------------------------------------------------------------
-- 4) Fornecedor: contatos e dados que faltavam
-- ---------------------------------------------------------------------
alter table public.suppliers
  add column if not exists trade_name   text,
  add column if not exists whatsapp     text,
  add column if not exists contact_name text,
  add column if not exists address      text,
  add column if not exists city         text,
  add column if not exists state        text,
  add column if not exists updated_at   timestamptz not null default now();

comment on column public.suppliers.name is 'Razão social.';
comment on column public.suppliers.doc  is 'CNPJ.';

create table if not exists public.supplier_contacts (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name        text not null,
  role        text,
  phone       text,
  whatsapp    text,
  email       text,
  is_primary  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists supplier_contacts_idx on public.supplier_contacts (supplier_id) where active;

-- Um contato principal por fornecedor, garantido pelo banco.
create unique index if not exists supplier_contacts_primary_idx
  on public.supplier_contacts (supplier_id) where is_primary and active;

-- ---------------------------------------------------------------------
-- 5) Produto x fornecedor
-- ---------------------------------------------------------------------
create table if not exists public.supplier_products (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references public.suppliers(id) on delete cascade,
  part_id       uuid not null references public.parts(id) on delete cascade,
  supplier_code text,
  last_price    numeric(12, 2),
  delivery_days integer,
  min_quantity  numeric(12, 2),
  preferred     boolean not null default false,
  active        boolean not null default true,
  updated_at    timestamptz not null default now(),
  unique (supplier_id, part_id)
);
create index if not exists supplier_products_part_idx on public.supplier_products (part_id) where active;

-- ---------------------------------------------------------------------
-- 6) Solicitação de reposição
-- ---------------------------------------------------------------------
create sequence if not exists public.replenishment_number_seq;

create table if not exists public.replenishment_requests (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  part_id            uuid not null references public.parts(id) on delete restrict,
  supplier_id        uuid references public.suppliers(id) on delete set null,
  quantity_current   numeric(12, 2) not null,
  min_quantity       numeric(12, 2) not null,
  max_quantity       numeric(12, 2) not null,
  quantity_suggested numeric(12, 2) not null,
  quantity_requested numeric(12, 2),
  priority           public.replenishment_priority not null default 'normal',
  status             public.replenishment_status not null default 'pendente',
  notes              text,
  -- Nulo quando quem criou foi o próprio sistema, pela detecção automática.
  created_by         uuid references public.profiles(id) on delete set null,
  approved_by        uuid references public.profiles(id) on delete set null,
  approved_at        timestamptz,
  -- Prazo de resposta do fornecedor, para o alerta de silêncio.
  response_due_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists replenishment_part_idx   on public.replenishment_requests (part_id, created_at desc);
create index if not exists replenishment_status_idx on public.replenishment_requests (status, created_at desc);

-- Regra 3 da especificação, garantida pelo BANCO e não só pelo código: uma
-- solicitação viva por produto. Índice parcial é o que impede a corrida
-- entre duas detecções simultâneas criando duas solicitações.
create unique index if not exists replenishment_uma_aberta_por_produto
  on public.replenishment_requests (part_id)
  where status not in ('concluido', 'cancelado', 'recusado');

-- ---------------------------------------------------------------------
-- 7) Cotação do fornecedor
-- ---------------------------------------------------------------------
create table if not exists public.supplier_quotes (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.replenishment_requests(id) on delete cascade,
  supplier_id    uuid not null references public.suppliers(id) on delete restrict,
  quantity       numeric(12, 2) not null,
  unit_price     numeric(12, 2) not null default 0,
  shipping_cost  numeric(12, 2) not null default 0,
  discount       numeric(12, 2) not null default 0,
  -- Coluna gerada: total inconsistente com as parcelas é impossível.
  total_value    numeric(12, 2) generated always as
                   (quantity * unit_price + shipping_cost - discount) stored,
  payment_terms  text,
  delivery_days  integer,
  valid_until    date,
  notes          text,
  attachment_url text,
  status         text not null default 'registrada',
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists supplier_quotes_request_idx on public.supplier_quotes (request_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8) Pedido de compra
-- ---------------------------------------------------------------------
create sequence if not exists public.purchase_order_number_seq;

create table if not exists public.purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique,
  request_id        uuid references public.replenishment_requests(id) on delete set null,
  quote_id          uuid references public.supplier_quotes(id) on delete set null,
  supplier_id       uuid not null references public.suppliers(id) on delete restrict,
  status            public.purchase_order_status not null default 'criado',
  subtotal          numeric(12, 2) not null default 0,
  shipping          numeric(12, 2) not null default 0,
  discount          numeric(12, 2) not null default 0,
  total             numeric(12, 2) not null default 0,
  payment_terms     text,
  expected_delivery date,
  approved_by       uuid references public.profiles(id) on delete set null,
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists purchase_orders_status_idx on public.purchase_orders (status, created_at desc);

-- ---------------------------------------------------------------------
-- 9) Recebimento
--
-- Tabela própria em vez de campos no pedido: recebimento parcial é comum, e
-- cada chegada precisa da própria nota, lote e conferência.
-- ---------------------------------------------------------------------
create table if not exists public.purchase_receipts (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete cascade,
  part_id            uuid not null references public.parts(id) on delete restrict,
  quantity_ordered   numeric(12, 2) not null,
  quantity_received  numeric(12, 2) not null check (quantity_received > 0),
  unit_price         numeric(12, 2),
  invoice_number     text,
  invoice_url        text,
  batch              text,
  expires_at         date,
  notes              text,
  -- Regra 20: o estoque só se mexe quando isto vira verdadeiro.
  confirmed          boolean not null default false,
  confirmed_by       uuid references public.profiles(id) on delete set null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists purchase_receipts_order_idx on public.purchase_receipts (purchase_order_id);

-- ---------------------------------------------------------------------
-- 10) Comunicações com o fornecedor
-- ---------------------------------------------------------------------
create table if not exists public.supplier_communications (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  request_id  uuid references public.replenishment_requests(id) on delete set null,
  channel     public.supplier_channel not null,
  recipient   text,
  subject     text,
  message     text,
  status      text not null default 'enviado',
  sent_at     timestamptz not null default now(),
  response_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists supplier_comm_request_idx on public.supplier_communications (request_id, sent_at desc);

-- ---------------------------------------------------------------------
-- 11) Histórico de movimentação: saldo antes e depois
--
-- Sem isso, reconstruir o saldo de uma data exige somar a tabela inteira e
-- torcer para nada ter sido ajustado fora do fluxo.
-- ---------------------------------------------------------------------
alter table public.inventory_movements
  add column if not exists quantity_before numeric(12, 2),
  add column if not exists quantity_after  numeric(12, 2),
  add column if not exists reference_type  text,
  add column if not exists reference_id    uuid,
  add column if not exists reason          text;

create index if not exists inventory_movements_ref_idx
  on public.inventory_movements (reference_type, reference_id);

-- ---------------------------------------------------------------------
-- 12) Numeração
-- ---------------------------------------------------------------------
create or replace function public.proximo_numero_reposicao()
returns text
language sql volatile security definer set search_path = public
as $$
  select 'REQ-' || lpad(nextval('public.replenishment_number_seq')::text, 6, '0');
$$;

create or replace function public.proximo_numero_pedido()
returns text
language sql volatile security definer set search_path = public
as $$
  select 'PC-' || lpad(nextval('public.purchase_order_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------
-- 13) Movimentação de estoque — porta única
--
-- Toda entrada e saída passa por aqui (regra 5). A função grava o saldo
-- anterior e o final na mesma transação em que altera o inventário, então
-- histórico e saldo nunca divergem.
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

-- ---------------------------------------------------------------------
-- 14) Detecção de estoque baixo e criação da solicitação
--
-- Não compra nada: apenas registra a necessidade e avisa quem decide
-- (regra 1). A sugestão é máximo menos atual, ou a quantidade fixa de
-- reposição quando o produto tiver uma.
-- ---------------------------------------------------------------------
create or replace function public.criar_solicitacao_reposicao(p_part_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv       public.inventory%rowtype;
  v_part      public.parts%rowtype;
  v_sugerida  numeric;
  v_fornec    uuid;
  v_prio      public.replenishment_priority;
  v_id        uuid;
begin
  select * into v_inv  from public.inventory where part_id = p_part_id;
  select * into v_part from public.parts     where id = p_part_id;
  if not found or v_inv.part_id is null or not v_part.active then
    return null;
  end if;

  -- Regra 3: existindo solicitação viva, não cria outra.
  if exists (
    select 1 from public.replenishment_requests
     where part_id = p_part_id
       and status not in ('concluido', 'cancelado', 'recusado')
  ) then
    return null;
  end if;

  v_sugerida := coalesce(
    nullif(v_inv.reorder_quantity, 0),
    greatest(v_inv.max_quantity - v_inv.quantity, 0));

  -- Sem máximo configurado não há como sugerir quantidade; o produto entra
  -- como alerta, não como solicitação com número inventado.
  if v_sugerida <= 0 then
    return null;
  end if;

  -- Zerado é urgente: sem saldo o atendimento para.
  v_prio := case
              when v_inv.quantity <= 0 then 'urgente'
              when v_inv.min_quantity > 0 and v_inv.quantity <= v_inv.min_quantity / 2 then 'alta'
              else 'normal'
            end;

  -- Fornecedor principal do cadastro, ou o preferencial da relação
  -- produto x fornecedor quando o produto não tiver um definido.
  v_fornec := v_part.supplier_id;
  if v_fornec is null then
    select supplier_id into v_fornec
      from public.supplier_products
     where part_id = p_part_id and active
     order by preferred desc, last_price nulls last
     limit 1;
  end if;

  insert into public.replenishment_requests
    (number, part_id, supplier_id, quantity_current, min_quantity, max_quantity,
     quantity_suggested, quantity_requested, priority, status, created_by)
  values
    (public.proximo_numero_reposicao(), p_part_id, v_fornec,
     v_inv.quantity, v_inv.min_quantity, v_inv.max_quantity,
     v_sugerida, v_sugerida, v_prio, 'pendente', auth.uid())
  returning id into v_id;

  perform public.notificar_evento('REPLENISHMENT_CREATED', 'reposicao', v_id,
    jsonb_build_object(
      'titulo', 'Nova solicitação de reposição',
      'corpo', 'Produto ' || v_part.name || ': sugestão de ' || v_sugerida ||
               ' ' || coalesce(v_part.unit, 'un') || '.'));

  return v_id;
exception
  -- O índice único pode barrar uma corrida entre duas detecções ao mesmo
  -- tempo. Isso é o comportamento desejado, não um erro a propagar.
  when unique_violation then return null;
end;
$$;

/** Varredura periódica — o checkLowStock da especificação. */
create or replace function public.verificar_estoque_baixo()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_item  record;
  v_criadas integer := 0;
begin
  for v_item in
    select i.part_id from public.inventory i
      join public.parts p on p.id = i.part_id
     where p.active and i.quantity <= i.min_quantity
  loop
    if public.criar_solicitacao_reposicao(v_item.part_id) is not null then
      v_criadas := v_criadas + 1;
    end if;
  end loop;
  return v_criadas;
end;
$$;

-- Detecção na hora em que o saldo cruza o mínimo.
create or replace function public.tg_estoque_baixo_solicita()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.quantity <= new.min_quantity
     and (tg_op = 'INSERT' or old.quantity > old.min_quantity) then
    perform public.criar_solicitacao_reposicao(new.part_id);
  end if;
  return new;
exception when others then
  -- Reposição é consequência, não requisito: falhar aqui não pode impedir a
  -- movimentação de estoque que a originou.
  raise warning 'Solicitação automática falhou para %: %', new.part_id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists inventory_solicita_reposicao on public.inventory;
create trigger inventory_solicita_reposicao
  after insert or update of quantity, min_quantity on public.inventory
  for each row execute function public.tg_estoque_baixo_solicita();

-- ---------------------------------------------------------------------
-- 15) Aprovação gera pedido de compra
-- ---------------------------------------------------------------------
create or replace function public.aprovar_reposicao(
  p_request_id uuid,
  p_quote_id   uuid
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_req   public.replenishment_requests%rowtype;
  v_quote public.supplier_quotes%rowtype;
  v_id    uuid;
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador aprova compras';
  end if;

  select * into v_req   from public.replenishment_requests where id = p_request_id;
  select * into v_quote from public.supplier_quotes        where id = p_quote_id;
  if v_req.id is null or v_quote.id is null then
    raise exception 'Solicitação ou cotação inexistente';
  end if;
  if v_quote.request_id <> v_req.id then
    raise exception 'A cotação não pertence a esta solicitação';
  end if;

  update public.replenishment_requests
     set status = 'aprovado', approved_by = auth.uid(), approved_at = now(), updated_at = now()
   where id = p_request_id;

  insert into public.purchase_orders
    (number, request_id, quote_id, supplier_id, status,
     subtotal, shipping, discount, total, payment_terms, expected_delivery,
     approved_by, approved_at)
  values
    (public.proximo_numero_pedido(), p_request_id, p_quote_id, v_quote.supplier_id, 'criado',
     v_quote.quantity * v_quote.unit_price, v_quote.shipping_cost, v_quote.discount,
     v_quote.total_value, v_quote.payment_terms,
     case when v_quote.delivery_days is not null
          then (current_date + v_quote.delivery_days) end,
     auth.uid(), now())
  returning id into v_id;

  update public.replenishment_requests set status = 'comprado' where id = p_request_id;

  perform public.notificar_evento('PURCHASE_CREATED', 'pedido', v_id,
    jsonb_build_object('titulo', 'Pedido de compra gerado',
                       'corpo', 'Solicitação ' || v_req.number || ' aprovada e convertida em pedido.'));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 16) Recebimento confirmado dá entrada no estoque
--
-- Regra 20: até a confirmação, nada entra. O gatilho dispara na virada do
-- campo, e a entrada passa pela porta única de movimentação.
-- ---------------------------------------------------------------------
create or replace function public.tg_recebimento_confirmado()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pedido public.purchase_orders%rowtype;
begin
  if new.confirmed and (tg_op = 'INSERT' or not old.confirmed) then
    select * into v_pedido from public.purchase_orders where id = new.purchase_order_id;

    perform public.movimentar_estoque(
      new.part_id, 'recebimento_compra', new.quantity_received,
      'Recebimento do pedido ' || coalesce(v_pedido.number, ''),
      'recebimento', new.id);

    update public.purchase_orders
       set status = 'recebido', updated_at = now()
     where id = new.purchase_order_id;

    update public.replenishment_requests
       set status = 'concluido', updated_at = now()
     where id = v_pedido.request_id;

    new.confirmed_at := coalesce(new.confirmed_at, now());
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());

    perform public.notificar_evento('PURCHASE_RECEIVED', 'pedido', new.purchase_order_id,
      jsonb_build_object('titulo', 'Material recebido',
                         'corpo', 'Entrada de ' || new.quantity_received ||
                                  ' registrada no pedido ' || coalesce(v_pedido.number, '') || '.'));
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_receipts_confirma on public.purchase_receipts;
create trigger purchase_receipts_confirma
  before insert or update of confirmed on public.purchase_receipts
  for each row execute function public.tg_recebimento_confirmado();

-- ---------------------------------------------------------------------
-- 17) Eventos novos no catálogo da 0022
-- ---------------------------------------------------------------------
insert into public.notification_events (evento, categoria, priority, critico, descricao) values
  ('STOCK_CRITICAL',        'estoque', 'urgent', true,  'Produto zerado ou em nível crítico'),
  ('REPLENISHMENT_CREATED', 'estoque', 'high',   false, 'Solicitação de reposição criada'),
  ('REPLENISHMENT_SENT',    'estoque', 'normal', false, 'Solicitação enviada ao fornecedor'),
  ('SUPPLIER_RESPONDED',    'estoque', 'high',   false, 'Fornecedor respondeu'),
  ('SUPPLIER_SILENT',       'estoque', 'normal', false, 'Fornecedor não respondeu no prazo'),
  ('PURCHASE_CREATED',      'estoque', 'normal', false, 'Pedido de compra gerado'),
  ('PURCHASE_SENT',         'estoque', 'normal', false, 'Pedido enviado ao fornecedor'),
  ('PURCHASE_CONFIRMED',    'estoque', 'normal', false, 'Fornecedor confirmou o pedido'),
  ('PURCHASE_IN_TRANSIT',   'estoque', 'normal', false, 'Pedido em trânsito'),
  ('PURCHASE_RECEIVED',     'estoque', 'high',   false, 'Material recebido')
on conflict (evento) do update
  set categoria = excluded.categoria, priority = excluded.priority,
      critico = excluded.critico, descricao = excluded.descricao;

-- ---------------------------------------------------------------------
-- 18) RLS
--
-- Cliente não enxerga nada do estoque interno. Técnico lê o catálogo e a
-- disponibilidade para saber com o que conta em campo, mas não escreve.
-- Escrita é do administrador, e sempre pelas funções acima.
-- ---------------------------------------------------------------------
alter table public.part_categories          enable row level security;
alter table public.supplier_contacts        enable row level security;
alter table public.supplier_products        enable row level security;
alter table public.replenishment_requests   enable row level security;
alter table public.supplier_quotes          enable row level security;
alter table public.purchase_orders          enable row level security;
alter table public.purchase_receipts        enable row level security;
alter table public.supplier_communications  enable row level security;

drop policy if exists part_categories_read on public.part_categories;
create policy part_categories_read on public.part_categories
  for select using (public.is_admin() or public.my_technician_id() is not null);
drop policy if exists part_categories_admin on public.part_categories;
create policy part_categories_admin on public.part_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Dados de fornecedor são comerciais: só administração.
drop policy if exists supplier_contacts_admin on public.supplier_contacts;
create policy supplier_contacts_admin on public.supplier_contacts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists supplier_products_admin on public.supplier_products;
create policy supplier_products_admin on public.supplier_products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists supplier_quotes_admin on public.supplier_quotes;
create policy supplier_quotes_admin on public.supplier_quotes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists purchase_orders_admin on public.purchase_orders;
create policy purchase_orders_admin on public.purchase_orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists purchase_receipts_admin on public.purchase_receipts;
create policy purchase_receipts_admin on public.purchase_receipts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists supplier_comm_admin on public.supplier_communications;
create policy supplier_comm_admin on public.supplier_communications
  for all using (public.is_admin()) with check (public.is_admin());

-- O técnico acompanha a reposição do material que ele depende, sem ver preço
-- de fornecedor — que fica em supplier_quotes, fechada para ele.
drop policy if exists replenishment_read on public.replenishment_requests;
create policy replenishment_read on public.replenishment_requests
  for select using (public.is_admin() or public.my_technician_id() is not null);
drop policy if exists replenishment_admin on public.replenishment_requests;
create policy replenishment_admin on public.replenishment_requests
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on function public.movimentar_estoque(uuid, public.movement_type, numeric, text, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.criar_solicitacao_reposicao(uuid) from public, anon;
revoke all on function public.verificar_estoque_baixo() from public, anon;
revoke all on function public.aprovar_reposicao(uuid, uuid) from public, anon;
grant execute on function public.verificar_estoque_baixo() to authenticated;
grant execute on function public.aprovar_reposicao(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 19) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('part_categories','supplier_contacts','supplier_products',
                         'replenishment_requests','supplier_quotes','purchase_orders',
                         'purchase_receipts','supplier_communications')) as tabelas_novas_deve_ser_8,
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname = 'replenishment_uma_aberta_por_produto')            as trava_duplicidade_deve_ser_1,
  (select count(*) from public.notification_events
    where categoria = 'estoque')                                        as eventos_estoque;
