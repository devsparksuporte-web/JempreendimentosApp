-- =====================================================================
-- JEmpreendimentos - Schema completo
--
-- Arquivo unico para colar no SQL Editor do Supabase.
-- IDEMPOTENTE: pode ser executado mais de uma vez sem erro.
-- Equivale a rodar, na ordem:
--   supabase/migrations/0001_init.sql
--   supabase/migrations/0002_seed.sql
-- =====================================================================

-- =====================================================================
-- JEmpreendimentos — Schema inicial
-- Gestão de instalação, manutenção e assistência técnica de ar-condicionado
--
-- Cobre: perfis, clientes, equipamentos, QR Code, chamados, agenda,
-- checklist, fotos, assinatura, estoque, PMOC, IA, WhatsApp, financeiro,
-- notificações e auditoria — com Row Level Security em todas as tabelas.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('cliente', 'tecnico', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_status as enum (
  'aberto',
  'em_analise',
  'aguardando_tecnico',
  'tecnico_atribuido',
  'a_caminho',
  'em_atendimento',
  'aguardando_peca',
  'aguardando_aprovacao',
  'finalizado',
  'cancelado'
);
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_priority as enum ('baixa', 'normal', 'alta', 'urgente');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_type as enum (
  'instalacao',
  'manutencao_preventiva',
  'manutencao_corretiva',
  'higienizacao',
  'pmoc',
  'orcamento',
  'visita_tecnica'
);
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.photo_stage as enum ('antes', 'durante', 'depois');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.movement_type as enum ('entrada', 'saida', 'ajuste');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.financial_type as enum ('pagar', 'receber');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.financial_status as enum ('pendente', 'pago', 'atrasado', 'cancelado');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.technician_status as enum ('disponivel', 'em_atendimento', 'a_caminho', 'indisponivel');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.quotation_status as enum ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.ai_channel as enum ('app', 'whatsapp');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.ai_role as enum ('user', 'assistant', 'system');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.wa_direction as enum ('entrada', 'saida');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- TRIGGER: updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- IDENTIDADE
-- =====================================================================

-- profiles: 1:1 com auth.users. Define o perfil de acesso.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'cliente',
  full_name   text not null default '',
  email       text,
  phone       text,
  whatsapp    text,
  avatar_url  text,
  push_token  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role) where active;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Cria o profile automaticamente ao registrar um usuário.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'cliente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Os helpers de autorização (auth_role, is_admin, my_client_id,
-- my_technician_id, can_see_call) ficam logo antes da seção de RLS: são
-- funções `language sql`, cujo corpo o Postgres valida na criação, então
-- precisam vir depois das tabelas que consultam.

-- =====================================================================
-- CLIENTES
-- =====================================================================
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid unique references public.profiles(id) on delete set null,
  name        text not null,
  doc         text,                      -- CPF ou CNPJ
  doc_type    text check (doc_type in ('cpf', 'cnpj')),
  phone       text,
  whatsapp    text,
  email       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists clients_name_idx on public.clients (lower(name));
create index if not exists clients_whatsapp_idx on public.clients (whatsapp);
create unique index if not exists clients_doc_idx on public.clients (doc) where doc is not null;
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

create table if not exists public.client_addresses (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  label        text not null default 'Principal',
  street       text not null,
  number       text,
  complement   text,
  district     text,
  city         text not null,
  state        text,
  zip_code     text,
  latitude     numeric(10, 7),
  longitude    numeric(10, 7),
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists client_addresses_client_idx on public.client_addresses (client_id);
drop trigger if exists client_addresses_touch on public.client_addresses;
create trigger client_addresses_touch before update on public.client_addresses
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- TÉCNICOS
-- =====================================================================
create table if not exists public.technicians (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid unique not null references public.profiles(id) on delete cascade,
  registration  text unique,
  specialties   text[] not null default '{}',
  status        public.technician_status not null default 'disponivel',
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists technicians_status_idx on public.technicians (status) where active;
drop trigger if exists technicians_touch on public.technicians;
create trigger technicians_touch before update on public.technicians
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- EQUIPAMENTOS
-- =====================================================================
create table if not exists public.equipment (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  address_id     uuid references public.client_addresses(id) on delete set null,
  environment    text,                    -- ambiente: Sala, Quarto, Recepção...
  brand          text,
  model          text,
  serial_number  text,
  kind           text,                    -- split, cassete, janela, multi-split...
  btu_capacity   integer,
  gas_type       text,                    -- R410A, R32, R22...
  technology     text,                    -- inverter, convencional
  installed_at   date,
  warranty_until date,
  notes          text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists equipment_client_idx on public.equipment (client_id) where active;
create index if not exists equipment_address_idx on public.equipment (address_id);
create index if not exists equipment_serial_idx on public.equipment (serial_number) where serial_number is not null;
drop trigger if exists equipment_touch on public.equipment;
create trigger equipment_touch before update on public.equipment
  for each row execute function public.touch_updated_at();

create table if not exists public.equipment_photos (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  storage_path  text not null,
  caption       text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists equipment_photos_equipment_idx on public.equipment_photos (equipment_id);

-- QR Code exclusivo por equipamento (permite rotacionar mantendo histórico)
create table if not exists public.equipment_qr_codes (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  code          text not null unique default encode(gen_random_bytes(9), 'hex'),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists equipment_qr_equipment_idx on public.equipment_qr_codes (equipment_id) where active;

-- Todo equipamento nasce com um QR Code.
create or replace function public.create_equipment_qr()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.equipment_qr_codes (equipment_id) values (new.id);
  return new;
end;
$$;
drop trigger if exists equipment_qr_autocreate on public.equipment;
create trigger equipment_qr_autocreate after insert on public.equipment
  for each row execute function public.create_equipment_qr();

-- =====================================================================
-- CHAMADOS
-- =====================================================================
create sequence if not exists public.service_call_code_seq start 2847;

create table if not exists public.service_calls (
  id             uuid primary key default gen_random_uuid(),
  code           integer not null unique default nextval('public.service_call_code_seq'),
  client_id      uuid not null references public.clients(id) on delete restrict,
  equipment_id   uuid references public.equipment(id) on delete set null,
  address_id     uuid references public.client_addresses(id) on delete set null,
  technician_id  uuid references public.technicians(id) on delete set null,
  status         public.service_status not null default 'aberto',
  priority       public.service_priority not null default 'normal',
  service_type   public.service_type not null default 'manutencao_corretiva',
  title          text not null,
  description    text,
  ai_summary     jsonb,                   -- resumo estruturado gerado pela IA
  diagnosis      text,
  solution       text,
  scheduled_for  timestamptz,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists service_calls_client_idx on public.service_calls (client_id, created_at desc);
create index if not exists service_calls_technician_idx on public.service_calls (technician_id, scheduled_for);
create index if not exists service_calls_equipment_idx on public.service_calls (equipment_id, created_at desc);
create index if not exists service_calls_status_idx on public.service_calls (status)
  where status not in ('finalizado', 'cancelado');
create index if not exists service_calls_priority_idx on public.service_calls (priority, created_at desc)
  where status not in ('finalizado', 'cancelado');
drop trigger if exists service_calls_touch on public.service_calls;
create trigger service_calls_touch before update on public.service_calls
  for each row execute function public.touch_updated_at();

create table if not exists public.service_call_status_history (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null references public.service_calls(id) on delete cascade,
  from_status      public.service_status,
  to_status        public.service_status not null,
  note             text,
  changed_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists sc_status_history_call_idx on public.service_call_status_history (service_call_id, created_at);

-- Toda mudança de status vira histórico automaticamente.
create or replace function public.log_service_call_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.service_call_status_history (service_call_id, to_status, changed_by)
    values (new.id, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.service_call_status_history (service_call_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists service_calls_status_log on public.service_calls;
create trigger service_calls_status_log after insert or update of status on public.service_calls
  for each row execute function public.log_service_call_status();

create table if not exists public.service_call_messages (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null references public.service_calls(id) on delete cascade,
  sender_id        uuid references public.profiles(id) on delete set null,
  body             text not null,
  attachments      jsonb not null default '[]',
  created_at       timestamptz not null default now()
);
create index if not exists sc_messages_call_idx on public.service_call_messages (service_call_id, created_at);

-- =====================================================================
-- AGENDA
-- =====================================================================
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null references public.service_calls(id) on delete cascade,
  technician_id    uuid references public.technicians(id) on delete set null,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists appointments_technician_idx on public.appointments (technician_id, starts_at);
create index if not exists appointments_starts_idx on public.appointments (starts_at);
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- CHECKLIST
-- =====================================================================
create table if not exists public.checklists (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  service_type  public.service_type not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references public.checklists(id) on delete cascade,
  label         text not null,
  help_text     text,
  input_type    text not null default 'boolean'
                check (input_type in ('boolean', 'text', 'number', 'photo')),
  required      boolean not null default true,
  order_index   integer not null default 0
);
create index if not exists checklist_items_checklist_idx on public.checklist_items (checklist_id, order_index);

create table if not exists public.service_call_checklist_results (
  id                 uuid primary key default gen_random_uuid(),
  service_call_id    uuid not null references public.service_calls(id) on delete cascade,
  checklist_item_id  uuid not null references public.checklist_items(id) on delete cascade,
  checked            boolean not null default false,
  value              text,
  note               text,
  completed_by       uuid references public.profiles(id) on delete set null,
  completed_at       timestamptz,
  unique (service_call_id, checklist_item_id)
);
create index if not exists sc_checklist_results_call_idx on public.service_call_checklist_results (service_call_id);

-- =====================================================================
-- FOTOS E ASSINATURA
-- Estrutura lógica: Cliente > Equipamento > Chamado > Foto
-- =====================================================================
create table if not exists public.service_photos (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null references public.service_calls(id) on delete cascade,
  equipment_id     uuid references public.equipment(id) on delete set null,
  stage            public.photo_stage not null,
  storage_path     text not null,
  caption          text,
  taken_by         uuid references public.profiles(id) on delete set null,
  taken_at         timestamptz not null default now()
);
create index if not exists service_photos_call_idx on public.service_photos (service_call_id, stage);
create index if not exists service_photos_equipment_idx on public.service_photos (equipment_id, taken_at desc);

create table if not exists public.signatures (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null unique references public.service_calls(id) on delete cascade,
  signer_name      text not null,
  signer_doc       text,
  storage_path     text not null,
  technician_id    uuid references public.technicians(id) on delete set null,
  signed_at        timestamptz not null default now()
);

create table if not exists public.documents (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete cascade,
  equipment_id     uuid references public.equipment(id) on delete cascade,
  service_call_id  uuid references public.service_calls(id) on delete cascade,
  kind             text not null,          -- laudo, certificado_pmoc, orcamento, nota...
  title            text not null,
  storage_path     text not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists documents_client_idx on public.documents (client_id, created_at desc);
create index if not exists documents_call_idx on public.documents (service_call_id);

-- =====================================================================
-- ESTOQUE
-- =====================================================================
create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  doc         text,
  phone       text,
  email       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.parts (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique,
  name         text not null,
  description  text,
  unit         text not null default 'un',
  cost_price   numeric(12, 2),
  sale_price   numeric(12, 2),
  supplier_id  uuid references public.suppliers(id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists parts_name_idx on public.parts (lower(name)) where active;
drop trigger if exists parts_touch on public.parts;
create trigger parts_touch before update on public.parts
  for each row execute function public.touch_updated_at();

create table if not exists public.inventory (
  part_id      uuid primary key references public.parts(id) on delete cascade,
  quantity     numeric(12, 2) not null default 0,
  min_quantity numeric(12, 2) not null default 0,
  location     text,
  updated_at   timestamptz not null default now()
);
-- Índice para o alerta de estoque baixo da IA
create index if not exists inventory_low_stock_idx on public.inventory (part_id) where quantity <= min_quantity;

create table if not exists public.inventory_movements (
  id               uuid primary key default gen_random_uuid(),
  part_id          uuid not null references public.parts(id) on delete restrict,
  type             public.movement_type not null,
  quantity         numeric(12, 2) not null check (quantity > 0),
  service_call_id  uuid references public.service_calls(id) on delete set null,
  technician_id    uuid references public.technicians(id) on delete set null,
  note             text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists inventory_movements_part_idx on public.inventory_movements (part_id, created_at desc);
create index if not exists inventory_movements_call_idx on public.inventory_movements (service_call_id);
create index if not exists inventory_movements_tech_idx on public.inventory_movements (technician_id, created_at desc);

-- Movimento de estoque atualiza o saldo automaticamente.
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.inventory (part_id, quantity) values (new.part_id, 0)
  on conflict (part_id) do nothing;

  update public.inventory
     set quantity = case new.type
                      when 'entrada' then quantity + new.quantity
                      when 'saida'   then quantity - new.quantity
                      else new.quantity
                    end,
         updated_at = now()
   where part_id = new.part_id;
  return new;
end;
$$;
drop trigger if exists inventory_movements_apply on public.inventory_movements;
create trigger inventory_movements_apply after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- Peças usadas no chamado: CHAMADO > PEÇA > BAIXA NO ESTOQUE
create table if not exists public.service_parts (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid not null references public.service_calls(id) on delete cascade,
  part_id          uuid not null references public.parts(id) on delete restrict,
  quantity         numeric(12, 2) not null check (quantity > 0),
  unit_price       numeric(12, 2),
  created_at       timestamptz not null default now()
);
create index if not exists service_parts_call_idx on public.service_parts (service_call_id);
create index if not exists service_parts_part_idx on public.service_parts (part_id);

-- Registrar peça no chamado gera a baixa no estoque.
create or replace function public.consume_part_on_service()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tech uuid;
begin
  select technician_id into v_tech from public.service_calls where id = new.service_call_id;
  insert into public.inventory_movements
    (part_id, type, quantity, service_call_id, technician_id, note, created_by)
  values
    (new.part_id, 'saida', new.quantity, new.service_call_id, v_tech, 'Baixa automática por uso em chamado', auth.uid());
  return new;
end;
$$;
drop trigger if exists service_parts_consume on public.service_parts;
create trigger service_parts_consume after insert on public.service_parts
  for each row execute function public.consume_part_on_service();

create table if not exists public.quotations (
  id               uuid primary key default gen_random_uuid(),
  service_call_id  uuid references public.service_calls(id) on delete set null,
  client_id        uuid not null references public.clients(id) on delete cascade,
  status           public.quotation_status not null default 'rascunho',
  total            numeric(12, 2) not null default 0,
  valid_until      date,
  notes            text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists quotations_client_idx on public.quotations (client_id, created_at desc);
drop trigger if exists quotations_touch on public.quotations;
create trigger quotations_touch before update on public.quotations
  for each row execute function public.touch_updated_at();

create table if not exists public.quotation_items (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations(id) on delete cascade,
  part_id       uuid references public.parts(id) on delete set null,
  description   text not null,
  quantity      numeric(12, 2) not null default 1,
  unit_price    numeric(12, 2) not null default 0
);
create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id);

-- =====================================================================
-- MANUTENÇÃO PREVENTIVA E PMOC
-- =====================================================================
create table if not exists public.maintenance_schedules (
  id                uuid primary key default gen_random_uuid(),
  equipment_id      uuid not null references public.equipment(id) on delete cascade,
  service_type      public.service_type not null default 'manutencao_preventiva',
  frequency_months  integer not null default 6 check (frequency_months > 0),
  last_done_at      date,
  next_due_at       date not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Suporta o alerta "manutenção preventiva em 7 dias"
create index if not exists maintenance_next_due_idx on public.maintenance_schedules (next_due_at) where active;
create index if not exists maintenance_equipment_idx on public.maintenance_schedules (equipment_id);
drop trigger if exists maintenance_schedules_touch on public.maintenance_schedules;
create trigger maintenance_schedules_touch before update on public.maintenance_schedules
  for each row execute function public.touch_updated_at();

create table if not exists public.pmoc (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  address_id     uuid references public.client_addresses(id) on delete set null,
  title          text not null,
  responsible_id uuid references public.technicians(id) on delete set null,
  start_date     date not null,
  end_date       date,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists pmoc_client_idx on public.pmoc (client_id) where active;
drop trigger if exists pmoc_touch on public.pmoc;
create trigger pmoc_touch before update on public.pmoc
  for each row execute function public.touch_updated_at();

create table if not exists public.pmoc_items (
  id                uuid primary key default gen_random_uuid(),
  pmoc_id           uuid not null references public.pmoc(id) on delete cascade,
  equipment_id      uuid not null references public.equipment(id) on delete cascade,
  routine           text not null,          -- limpeza, teste, inspeção...
  frequency_months  integer not null default 3 check (frequency_months > 0),
  last_execution    date,
  next_execution    date,
  service_call_id   uuid references public.service_calls(id) on delete set null,
  notes             text
);
create index if not exists pmoc_items_pmoc_idx on public.pmoc_items (pmoc_id);
create index if not exists pmoc_items_next_idx on public.pmoc_items (next_execution);

-- =====================================================================
-- IA
-- =====================================================================
create table if not exists public.ai_conversations (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id) on delete set null,
  client_id        uuid references public.clients(id) on delete cascade,
  service_call_id  uuid references public.service_calls(id) on delete set null,
  channel          public.ai_channel not null default 'app',
  title            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ai_conversations_profile_idx on public.ai_conversations (profile_id, created_at desc);
drop trigger if exists ai_conversations_touch on public.ai_conversations;
create trigger ai_conversations_touch before update on public.ai_conversations
  for each row execute function public.touch_updated_at();

create table if not exists public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  role             public.ai_role not null,
  content          text not null,
  metadata         jsonb not null default '{}',
  tokens           integer,
  created_at       timestamptz not null default now()
);
create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- Alertas e recomendações geradas pela IA (estoque, recorrência, preventiva...)
create table if not exists public.ai_insights (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,               -- estoque_baixo, problema_recorrente, preventiva...
  severity     text not null default 'info' check (severity in ('info', 'atencao', 'critico')),
  title        text not null,
  body         text,
  target_table text,
  target_id    uuid,
  data         jsonb not null default '{}',
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists ai_insights_open_idx on public.ai_insights (created_at desc) where resolved_at is null;

-- Controle de custo/uso da IA (a chave nunca fica no app — só no backend)
create table if not exists public.ai_usage_logs (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references public.profiles(id) on delete set null,
  feature        text not null,             -- triagem_cliente, assistente_tecnico...
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(12, 6),
  success        boolean not null default true,
  error          text,
  created_at     timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on public.ai_usage_logs (created_at desc);
create index if not exists ai_usage_profile_idx on public.ai_usage_logs (profile_id, created_at desc);

-- =====================================================================
-- WHATSAPP
-- =====================================================================
create table if not exists public.whatsapp_conversations (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients(id) on delete set null,
  phone            text not null,
  wa_conversation_id text,
  service_call_id  uuid references public.service_calls(id) on delete set null,
  last_message_at  timestamptz,
  open             boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists wa_conversations_phone_idx on public.whatsapp_conversations (phone);
create index if not exists wa_conversations_open_idx on public.whatsapp_conversations (last_message_at desc) where open;

create table if not exists public.whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction        public.wa_direction not null,
  body             text,
  media_url        text,
  wa_message_id    text,
  created_at       timestamptz not null default now()
);
create index if not exists wa_messages_conversation_idx on public.whatsapp_messages (conversation_id, created_at);

-- =====================================================================
-- FINANCEIRO
-- =====================================================================
create table if not exists public.financial_entries (
  id               uuid primary key default gen_random_uuid(),
  type             public.financial_type not null,
  status           public.financial_status not null default 'pendente',
  description      text not null,
  category         text,
  amount           numeric(12, 2) not null,
  due_date         date not null,
  paid_at          date,
  client_id        uuid references public.clients(id) on delete set null,
  service_call_id  uuid references public.service_calls(id) on delete set null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists financial_due_idx on public.financial_entries (due_date) where status = 'pendente';
create index if not exists financial_client_idx on public.financial_entries (client_id, due_date desc);
drop trigger if exists financial_entries_touch on public.financial_entries;
create trigger financial_entries_touch before update on public.financial_entries
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- NOTIFICAÇÕES E AUDITORIA
-- =====================================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  kind        text not null default 'info',
  data        jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (profile_id) where read_at is null;

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  table_name   text not null,
  record_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_logs_table_idx on public.audit_logs (table_name, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- =====================================================================
-- HELPERS DE AUTORIZAÇÃO
--
-- security definer: rodam com os privilégios do dono, portanto NÃO sofrem
-- RLS — é isso que evita recursão infinita quando uma policy de `clients`
-- precisa consultar `clients`.
--
-- Definidos aqui, depois de todas as tabelas: o corpo de função
-- `language sql` é validado no momento da criação.
-- =====================================================================
create or replace function public.auth_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.auth_role() = 'admin', false) $$;

create or replace function public.my_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.clients where profile_id = auth.uid() limit 1 $$;

create or replace function public.my_technician_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.technicians where profile_id = auth.uid() limit 1 $$;

-- O usuário enxerga este chamado?
create or replace function public.can_see_call(p_call uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.service_calls sc
    where sc.id = p_call
      and (public.is_admin()
           or sc.client_id = public.my_client_id()
           or sc.technician_id = public.my_technician_id())
  )
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Cliente nunca vê dados de outro cliente.
-- Técnico só vê o necessário aos atendimentos atribuídos a ele.
-- Admin tem acesso completo.
-- =====================================================================
alter table public.profiles                      enable row level security;
alter table public.clients                       enable row level security;
alter table public.client_addresses              enable row level security;
alter table public.technicians                   enable row level security;
alter table public.equipment                     enable row level security;
alter table public.equipment_photos              enable row level security;
alter table public.equipment_qr_codes            enable row level security;
alter table public.service_calls                 enable row level security;
alter table public.service_call_status_history   enable row level security;
alter table public.service_call_messages         enable row level security;
alter table public.appointments                  enable row level security;
alter table public.checklists                    enable row level security;
alter table public.checklist_items               enable row level security;
alter table public.service_call_checklist_results enable row level security;
alter table public.service_photos                enable row level security;
alter table public.signatures                    enable row level security;
alter table public.documents                     enable row level security;
alter table public.suppliers                     enable row level security;
alter table public.parts                         enable row level security;
alter table public.inventory                     enable row level security;
alter table public.inventory_movements           enable row level security;
alter table public.service_parts                 enable row level security;
alter table public.quotations                    enable row level security;
alter table public.quotation_items               enable row level security;
alter table public.maintenance_schedules         enable row level security;
alter table public.pmoc                          enable row level security;
alter table public.pmoc_items                    enable row level security;
alter table public.ai_conversations              enable row level security;
alter table public.ai_messages                   enable row level security;
alter table public.ai_insights                   enable row level security;
alter table public.ai_usage_logs                 enable row level security;
alter table public.whatsapp_conversations        enable row level security;
alter table public.whatsapp_messages             enable row level security;
alter table public.financial_entries             enable row level security;
alter table public.notifications                 enable row level security;
alter table public.audit_logs                    enable row level security;

-- --- profiles -------------------------------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- --- clients --------------------------------------------------------
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients
  for select using (
    public.is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1 from public.service_calls sc
      where sc.client_id = clients.id
        and sc.technician_id = public.my_technician_id()
    )
  );
drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients
  for all using (public.is_admin()) with check (public.is_admin());

-- --- client_addresses ----------------------------------------------
drop policy if exists client_addresses_read on public.client_addresses;
create policy client_addresses_read on public.client_addresses
  for select using (
    public.is_admin()
    or client_id = public.my_client_id()
    or exists (
      select 1 from public.service_calls sc
      where sc.client_id = client_addresses.client_id
        and sc.technician_id = public.my_technician_id()
    )
  );
drop policy if exists client_addresses_admin_write on public.client_addresses;
create policy client_addresses_admin_write on public.client_addresses
  for all using (public.is_admin()) with check (public.is_admin());

-- --- technicians ----------------------------------------------------
-- O cliente pode ver o técnico do seu chamado (nome/status na tela de acompanhamento).
drop policy if exists technicians_read on public.technicians;
create policy technicians_read on public.technicians
  for select using (
    public.is_admin()
    or profile_id = auth.uid()
    or exists (
      select 1 from public.service_calls sc
      where sc.technician_id = technicians.id
        and sc.client_id = public.my_client_id()
    )
  );
drop policy if exists technicians_update_self on public.technicians;
create policy technicians_update_self on public.technicians
  for update using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
drop policy if exists technicians_admin_write on public.technicians;
create policy technicians_admin_write on public.technicians
  for all using (public.is_admin()) with check (public.is_admin());

-- --- equipment ------------------------------------------------------
drop policy if exists equipment_read on public.equipment;
create policy equipment_read on public.equipment
  for select using (
    public.is_admin()
    or client_id = public.my_client_id()
    or exists (
      select 1 from public.service_calls sc
      where sc.equipment_id = equipment.id
        and sc.technician_id = public.my_technician_id()
    )
  );
drop policy if exists equipment_admin_write on public.equipment;
create policy equipment_admin_write on public.equipment
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists equipment_photos_read on public.equipment_photos;
create policy equipment_photos_read on public.equipment_photos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.equipment e
      where e.id = equipment_photos.equipment_id
        and (e.client_id = public.my_client_id()
             or exists (select 1 from public.service_calls sc
                        where sc.equipment_id = e.id
                          and sc.technician_id = public.my_technician_id()))
    )
  );
drop policy if exists equipment_photos_write on public.equipment_photos;
create policy equipment_photos_write on public.equipment_photos
  for insert with check (public.is_admin() or public.my_technician_id() is not null);

drop policy if exists equipment_qr_read on public.equipment_qr_codes;
create policy equipment_qr_read on public.equipment_qr_codes
  for select using (
    public.is_admin()
    or public.my_technician_id() is not null
    or exists (select 1 from public.equipment e
               where e.id = equipment_qr_codes.equipment_id
                 and e.client_id = public.my_client_id())
  );
drop policy if exists equipment_qr_admin_write on public.equipment_qr_codes;
create policy equipment_qr_admin_write on public.equipment_qr_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- --- service_calls --------------------------------------------------
drop policy if exists service_calls_read on public.service_calls;
create policy service_calls_read on public.service_calls
  for select using (
    public.is_admin()
    or client_id = public.my_client_id()
    or technician_id = public.my_technician_id()
  );
-- O cliente abre chamado apenas para si mesmo.
drop policy if exists service_calls_client_insert on public.service_calls;
create policy service_calls_client_insert on public.service_calls
  for insert with check (
    public.is_admin() or client_id = public.my_client_id()
  );
-- O técnico atualiza somente os chamados atribuídos a ele.
drop policy if exists service_calls_update on public.service_calls;
create policy service_calls_update on public.service_calls
  for update using (
    public.is_admin() or technician_id = public.my_technician_id()
  ) with check (
    public.is_admin() or technician_id = public.my_technician_id()
  );
drop policy if exists service_calls_admin_delete on public.service_calls;
create policy service_calls_admin_delete on public.service_calls
  for delete using (public.is_admin());

drop policy if exists sc_status_history_read on public.service_call_status_history;
create policy sc_status_history_read on public.service_call_status_history
  for select using (public.can_see_call(service_call_id));

drop policy if exists sc_messages_read on public.service_call_messages;
create policy sc_messages_read on public.service_call_messages
  for select using (public.can_see_call(service_call_id));
drop policy if exists sc_messages_insert on public.service_call_messages;
create policy sc_messages_insert on public.service_call_messages
  for insert with check (public.can_see_call(service_call_id) and sender_id = auth.uid());

drop policy if exists appointments_read on public.appointments;
create policy appointments_read on public.appointments
  for select using (
    public.is_admin()
    or technician_id = public.my_technician_id()
    or public.can_see_call(service_call_id)
  );
drop policy if exists appointments_admin_write on public.appointments;
create policy appointments_admin_write on public.appointments
  for all using (public.is_admin()) with check (public.is_admin());

-- --- checklist ------------------------------------------------------
-- Modelos de checklist são visíveis a quem está autenticado; só admin edita.
drop policy if exists checklists_read on public.checklists;
create policy checklists_read on public.checklists
  for select using (auth.uid() is not null);
drop policy if exists checklists_admin_write on public.checklists;
create policy checklists_admin_write on public.checklists
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists checklist_items_read on public.checklist_items;
create policy checklist_items_read on public.checklist_items
  for select using (auth.uid() is not null);
drop policy if exists checklist_items_admin_write on public.checklist_items;
create policy checklist_items_admin_write on public.checklist_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sc_checklist_results_read on public.service_call_checklist_results;
create policy sc_checklist_results_read on public.service_call_checklist_results
  for select using (public.can_see_call(service_call_id));
drop policy if exists sc_checklist_results_write on public.service_call_checklist_results;
create policy sc_checklist_results_write on public.service_call_checklist_results
  for all using (
    public.is_admin()
    or exists (select 1 from public.service_calls sc
               where sc.id = service_call_checklist_results.service_call_id
                 and sc.technician_id = public.my_technician_id())
  ) with check (
    public.is_admin()
    or exists (select 1 from public.service_calls sc
               where sc.id = service_call_checklist_results.service_call_id
                 and sc.technician_id = public.my_technician_id())
  );

-- --- fotos, assinatura, documentos ---------------------------------
drop policy if exists service_photos_read on public.service_photos;
create policy service_photos_read on public.service_photos
  for select using (public.can_see_call(service_call_id));
drop policy if exists service_photos_write on public.service_photos;
create policy service_photos_write on public.service_photos
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.service_calls sc
               where sc.id = service_photos.service_call_id
                 and sc.technician_id = public.my_technician_id())
  );

drop policy if exists signatures_read on public.signatures;
create policy signatures_read on public.signatures
  for select using (public.can_see_call(service_call_id));
drop policy if exists signatures_write on public.signatures;
create policy signatures_write on public.signatures
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.service_calls sc
               where sc.id = signatures.service_call_id
                 and sc.technician_id = public.my_technician_id())
  );

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select using (
    public.is_admin()
    or client_id = public.my_client_id()
    or (service_call_id is not null and public.can_see_call(service_call_id))
  );
drop policy if exists documents_admin_write on public.documents;
create policy documents_admin_write on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- --- estoque (interno: técnico lê, admin gerencia) ------------------
drop policy if exists suppliers_staff_read on public.suppliers;
create policy suppliers_staff_read on public.suppliers
  for select using (public.is_admin() or public.my_technician_id() is not null);
drop policy if exists suppliers_admin_write on public.suppliers;
create policy suppliers_admin_write on public.suppliers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists parts_staff_read on public.parts;
create policy parts_staff_read on public.parts
  for select using (public.is_admin() or public.my_technician_id() is not null);
drop policy if exists parts_admin_write on public.parts;
create policy parts_admin_write on public.parts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_staff_read on public.inventory;
create policy inventory_staff_read on public.inventory
  for select using (public.is_admin() or public.my_technician_id() is not null);
drop policy if exists inventory_admin_write on public.inventory;
create policy inventory_admin_write on public.inventory
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_movements_staff_read on public.inventory_movements;
create policy inventory_movements_staff_read on public.inventory_movements
  for select using (public.is_admin() or technician_id = public.my_technician_id());
drop policy if exists inventory_movements_staff_insert on public.inventory_movements;
create policy inventory_movements_staff_insert on public.inventory_movements
  for insert with check (public.is_admin() or public.my_technician_id() is not null);

drop policy if exists service_parts_read on public.service_parts;
create policy service_parts_read on public.service_parts
  for select using (public.can_see_call(service_call_id));
drop policy if exists service_parts_write on public.service_parts;
create policy service_parts_write on public.service_parts
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.service_calls sc
               where sc.id = service_parts.service_call_id
                 and sc.technician_id = public.my_technician_id())
  );

drop policy if exists quotations_read on public.quotations;
create policy quotations_read on public.quotations
  for select using (public.is_admin() or client_id = public.my_client_id());
drop policy if exists quotations_admin_write on public.quotations;
create policy quotations_admin_write on public.quotations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists quotation_items_read on public.quotation_items;
create policy quotation_items_read on public.quotation_items
  for select using (
    exists (select 1 from public.quotations q
            where q.id = quotation_items.quotation_id
              and (public.is_admin() or q.client_id = public.my_client_id()))
  );
drop policy if exists quotation_items_admin_write on public.quotation_items;
create policy quotation_items_admin_write on public.quotation_items
  for all using (public.is_admin()) with check (public.is_admin());

-- --- preventiva e PMOC ---------------------------------------------
drop policy if exists maintenance_read on public.maintenance_schedules;
create policy maintenance_read on public.maintenance_schedules
  for select using (
    public.is_admin()
    or exists (select 1 from public.equipment e
               where e.id = maintenance_schedules.equipment_id
                 and e.client_id = public.my_client_id())
    or public.my_technician_id() is not null
  );
drop policy if exists maintenance_admin_write on public.maintenance_schedules;
create policy maintenance_admin_write on public.maintenance_schedules
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pmoc_read on public.pmoc;
create policy pmoc_read on public.pmoc
  for select using (
    public.is_admin()
    or client_id = public.my_client_id()
    or responsible_id = public.my_technician_id()
  );
drop policy if exists pmoc_admin_write on public.pmoc;
create policy pmoc_admin_write on public.pmoc
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pmoc_items_read on public.pmoc_items;
create policy pmoc_items_read on public.pmoc_items
  for select using (
    exists (select 1 from public.pmoc p
            where p.id = pmoc_items.pmoc_id
              and (public.is_admin()
                   or p.client_id = public.my_client_id()
                   or p.responsible_id = public.my_technician_id()))
  );
drop policy if exists pmoc_items_admin_write on public.pmoc_items;
create policy pmoc_items_admin_write on public.pmoc_items
  for all using (public.is_admin()) with check (public.is_admin());

-- --- IA --------------------------------------------------------------
drop policy if exists ai_conversations_own on public.ai_conversations;
create policy ai_conversations_own on public.ai_conversations
  for select using (public.is_admin() or profile_id = auth.uid());
drop policy if exists ai_conversations_insert on public.ai_conversations;
create policy ai_conversations_insert on public.ai_conversations
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists ai_messages_own on public.ai_messages;
create policy ai_messages_own on public.ai_messages
  for select using (
    exists (select 1 from public.ai_conversations c
            where c.id = ai_messages.conversation_id
              and (public.is_admin() or c.profile_id = auth.uid()))
  );
drop policy if exists ai_messages_insert on public.ai_messages;
create policy ai_messages_insert on public.ai_messages
  for insert with check (
    exists (select 1 from public.ai_conversations c
            where c.id = ai_messages.conversation_id
              and (public.is_admin() or c.profile_id = auth.uid()))
  );

-- Insights operacionais são para a equipe interna, não para o cliente.
drop policy if exists ai_insights_staff_read on public.ai_insights;
create policy ai_insights_staff_read on public.ai_insights
  for select using (public.is_admin() or public.my_technician_id() is not null);
drop policy if exists ai_insights_admin_write on public.ai_insights;
create policy ai_insights_admin_write on public.ai_insights
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists ai_usage_admin on public.ai_usage_logs;
create policy ai_usage_admin on public.ai_usage_logs
  for select using (public.is_admin());

-- --- WhatsApp (somente admin) ---------------------------------------
drop policy if exists wa_conversations_admin on public.whatsapp_conversations;
create policy wa_conversations_admin on public.whatsapp_conversations
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists wa_messages_admin on public.whatsapp_messages;
create policy wa_messages_admin on public.whatsapp_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- --- financeiro (somente admin) -------------------------------------
drop policy if exists financial_admin on public.financial_entries;
create policy financial_admin on public.financial_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- --- notificações ----------------------------------------------------
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists notifications_admin_write on public.notifications;
create policy notifications_admin_write on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

-- --- auditoria (somente admin lê; ninguém edita pelo app) ------------
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select using (public.is_admin());

-- =====================================================================
-- STORAGE
-- Estrutura: <bucket>/<client_id>/<equipment_id>/<service_call_id>/<arquivo>
-- Nunca deixar foto solta sem vínculo.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('service-photos', 'service-photos', false),
       ('signatures', 'signatures', false),
       ('documents', 'documents', false),
       ('equipment-photos', 'equipment-photos', false)
on conflict (id) do nothing;

-- Equipe interna envia arquivos; leitura restrita a usuários autenticados
-- (o vínculo fino é garantido pelas tabelas que referenciam o storage_path).
drop policy if exists storage_staff_insert on storage.objects;
create policy storage_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('service-photos', 'signatures', 'documents', 'equipment-photos')
    and (public.is_admin() or public.my_technician_id() is not null)
  );

drop policy if exists storage_authenticated_read on storage.objects;
create policy storage_authenticated_read on storage.objects
  for select to authenticated
  using (bucket_id in ('service-photos', 'signatures', 'documents', 'equipment-photos'));

-- =====================================================================
-- REALTIME (dashboard de operação em tempo real)
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.service_calls;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.service_call_status_history;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.technicians;
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- JEmpreendimentos — Dados iniciais
-- Catálogo real (checklists e peças) + helper de demonstração.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CHECKLISTS PADRÃO
-- ---------------------------------------------------------------------
-- Um checklist por nome. O índice único torna o seed re-executável: se o
-- arquivo rodar duas vezes, o insert não duplica.
create unique index if not exists checklists_name_uidx on public.checklists (name);

do $$
declare
  v_prev uuid;
  v_corr uuid;
  v_inst uuid;
begin
  insert into public.checklists (name, service_type)
  values ('Manutenção Preventiva', 'manutencao_preventiva')
  on conflict (name) do nothing
  returning id into v_prev;

  -- Já existia: nada a semear.
  if v_prev is null then
    return;
  end if;

  insert into public.checklist_items (checklist_id, label, order_index, input_type) values
    (v_prev, 'Verificar e limpar filtros',              1, 'boolean'),
    (v_prev, 'Verificar evaporadora',                   2, 'boolean'),
    (v_prev, 'Verificar condensadora',                  3, 'boolean'),
    (v_prev, 'Verificar drenagem',                      4, 'boolean'),
    (v_prev, 'Medir temperatura de insuflamento (°C)',  5, 'number'),
    (v_prev, 'Verificar conexões elétricas',            6, 'boolean'),
    (v_prev, 'Verificar pressão do gás',                7, 'boolean'),
    (v_prev, 'Testar funcionamento geral',              8, 'boolean'),
    (v_prev, 'Foto do equipamento após o serviço',      9, 'photo'),
    (v_prev, 'Observações',                            10, 'text');

  insert into public.checklists (name, service_type)
  values ('Manutenção Corretiva', 'manutencao_corretiva')
  on conflict (name) do nothing
  returning id into v_corr;

  insert into public.checklist_items (checklist_id, label, order_index, input_type) values
    (v_corr, 'Foto do equipamento antes da intervenção', 1, 'photo'),
    (v_corr, 'Identificar sintoma relatado',             2, 'text'),
    (v_corr, 'Medir tensão de alimentação (V)',          3, 'number'),
    (v_corr, 'Verificar pressão do sistema',             4, 'boolean'),
    (v_corr, 'Verificar vazamento de gás',               5, 'boolean'),
    (v_corr, 'Verificar placa eletrônica',               6, 'boolean'),
    (v_corr, 'Diagnóstico técnico',                      7, 'text'),
    (v_corr, 'Solução aplicada',                         8, 'text'),
    (v_corr, 'Foto do equipamento após o reparo',        9, 'photo');

  insert into public.checklists (name, service_type)
  values ('Instalação', 'instalacao')
  on conflict (name) do nothing
  returning id into v_inst;

  insert into public.checklist_items (checklist_id, label, order_index, input_type) values
    (v_inst, 'Foto do local antes da instalação',      1, 'photo'),
    (v_inst, 'Conferir infraestrutura elétrica',       2, 'boolean'),
    (v_inst, 'Conferir ponto de dreno',                3, 'boolean'),
    (v_inst, 'Fixar suporte da condensadora',          4, 'boolean'),
    (v_inst, 'Instalar evaporadora',                   5, 'boolean'),
    (v_inst, 'Executar vácuo na linha',                6, 'boolean'),
    (v_inst, 'Teste de estanqueidade',                 7, 'boolean'),
    (v_inst, 'Medir temperatura em operação (°C)',     8, 'number'),
    (v_inst, 'Orientar cliente sobre uso e limpeza',   9, 'boolean'),
    (v_inst, 'Foto da instalação concluída',          10, 'photo');
end $$;

-- ---------------------------------------------------------------------
-- PEÇAS E ESTOQUE INICIAL
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

-- =====================================================================
-- DEMONSTRAÇÃO
-- Cria cliente, equipamentos e um chamado em andamento vinculados ao
-- usuário autenticado — para validar o app antes do cadastro real.
-- Remova em produção:  drop function public.seed_demo_for_current_user();
-- =====================================================================
create or replace function public.seed_demo_for_current_user()
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_client    uuid;
  v_address   uuid;
  v_equip_a   uuid;
  v_equip_b   uuid;
  v_call      uuid;
  v_tech      uuid;
  v_tech_prof uuid;
begin
  if v_uid is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  -- Já existe? Devolve o cliente atual sem duplicar.
  select id into v_client from public.clients where profile_id = v_uid;
  if v_client is not null then
    return v_client;
  end if;

  update public.profiles
     set full_name = coalesce(nullif(full_name, ''), 'João Silva'),
         role = 'cliente'
   where id = v_uid;

  insert into public.clients (profile_id, name, doc, doc_type, phone, whatsapp, email)
  select v_uid,
         coalesce(nullif(p.full_name, ''), 'João Silva'),
         '123.456.789-00', 'cpf', '(11) 98888-1234', '(11) 98888-1234', p.email
    from public.profiles p where p.id = v_uid
  returning id into v_client;

  insert into public.client_addresses
    (client_id, label, street, number, complement, district, city, state, zip_code, is_primary)
  values
    (v_client, 'Casa', 'Rua das Acácias', '250', 'Apartamento 1204',
     'Jardim Paulista', 'São Paulo', 'SP', '01415-000', true)
  returning id into v_address;

  insert into public.equipment
    (client_id, address_id, environment, brand, model, serial_number,
     kind, btu_capacity, gas_type, technology, installed_at, warranty_until)
  values
    (v_client, v_address, 'Sala', 'LG', 'Dual Inverter Voice S4-W12JA31A',
     'LG2401A7781', 'split', 12000, 'R-32', 'inverter',
     current_date - interval '18 months', current_date + interval '6 months')
  returning id into v_equip_a;

  insert into public.equipment
    (client_id, address_id, environment, brand, model, serial_number,
     kind, btu_capacity, gas_type, technology, installed_at, warranty_until)
  values
    (v_client, v_address, 'Quarto', 'Samsung', 'WindFree AR18BVFAAWK',
     'SM2312B4420', 'split', 18000, 'R-410A', 'inverter',
     current_date - interval '10 months', current_date + interval '14 months')
  returning id into v_equip_b;

  -- Manutenção preventiva programada (alimenta o card "Próxima manutenção")
  insert into public.maintenance_schedules (equipment_id, frequency_months, last_done_at, next_due_at)
  values (v_equip_a, 6, current_date - interval '6 months', current_date + interval '10 days'),
         (v_equip_b, 6, current_date - interval '2 months', current_date + interval '4 months');

  -- Técnico de demonstração (sem login próprio; só para exibir na tela)
  select t.id into v_tech from public.technicians t
    join public.profiles p on p.id = t.profile_id
   where p.full_name = 'Ricardo Oliveira' limit 1;

  if v_tech is null then
    select id into v_tech_prof from public.profiles
     where full_name = 'Ricardo Oliveira' and role = 'tecnico' limit 1;

    if v_tech_prof is not null then
      insert into public.technicians (profile_id, registration, specialties, status)
      values (v_tech_prof, 'TEC-0142', array['split', 'inverter', 'pmoc'], 'a_caminho')
      returning id into v_tech;
    end if;
  end if;

  -- Chamado nasce ABERTO e percorre os status de verdade: assim o trigger
  -- log_service_call_status monta o histórico real, com uma linha por
  -- transição — é isso que a timeline da tela de acompanhamento lê.
  insert into public.service_calls
    (client_id, equipment_id, address_id, status, priority,
     service_type, title, description, ai_summary, created_by, scheduled_for)
  values
    (v_client, v_equip_a, v_address, 'aberto', 'alta',
     'manutencao_corretiva',
     'Ar-condicionado não está gelando',
     'Cliente relatou que o aparelho liga normalmente mas não gela.',
     jsonb_build_object(
       'equipamento', 'LG 12.000 BTUs - Sala',
       'sintoma', 'Não está gelando',
       'inicio', 'Esta semana',
       'codigo_erro', 'Não informado',
       'resumo', 'Cliente relatou que o aparelho nao esta gelando. Sintoma iniciado nesta semana. Sem codigo de erro informado.'
     ),
     v_uid, now() + interval '15 minutes')
  returning id into v_call;

  update public.service_calls set status = 'em_analise'        where id = v_call;
  update public.service_calls set status = 'tecnico_atribuido',
                                  technician_id = v_tech       where id = v_call;
  update public.service_calls set status = 'a_caminho'         where id = v_call;

  -- Recua os horários para a timeline contar uma história plausível.
  update public.service_call_status_history h
     set created_at = now() - t.atras
    from (values
           ('aberto'::public.service_status,            interval '5 hours'),
           ('em_analise',                               interval '4 hours 50 minutes'),
           ('tecnico_atribuido',                        interval '4 hours'),
           ('a_caminho',                                interval '10 minutes')
         ) as t(status, atras)
   where h.service_call_id = v_call
     and h.to_status = t.status;

  return v_client;
end;
$$;

revoke all on function public.seed_demo_for_current_user() from public;
grant execute on function public.seed_demo_for_current_user() to authenticated;
