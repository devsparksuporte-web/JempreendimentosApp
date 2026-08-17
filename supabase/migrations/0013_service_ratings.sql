create table if not exists public.service_ratings (
  id uuid primary key default gen_random_uuid(),
  service_call_id uuid not null references public.service_calls(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  punctual boolean,
  equipment_condition text check (equipment_condition in ('perfeito', 'parcial', 'problemas')),
  feeling text check (feeling in ('triste', 'neutro', 'feliz', 'otimo', 'apaixonado')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_call_id)
);

alter table public.service_ratings enable row level security;

drop policy if exists service_ratings_select on public.service_ratings;
create policy service_ratings_select on public.service_ratings for select using (
  public.is_admin() or client_id = public.my_client_id() or exists (
    select 1 from public.service_calls sc where sc.id = service_call_id and sc.technician_id = public.my_technician_id()
  )
);

drop policy if exists service_ratings_insert on public.service_ratings;
create policy service_ratings_insert on public.service_ratings for insert with check (
  client_id = public.my_client_id() and exists (
    select 1 from public.service_calls sc where sc.id = service_call_id and sc.client_id = public.my_client_id() and sc.status = 'finalizado'
  )
);

drop policy if exists service_ratings_update on public.service_ratings;
create policy service_ratings_update on public.service_ratings for update using (public.is_admin() or client_id = public.my_client_id()) with check (public.is_admin() or client_id = public.my_client_id());

create index if not exists service_ratings_call_idx on public.service_ratings(service_call_id);
create index if not exists service_ratings_client_idx on public.service_ratings(client_id, created_at desc);
