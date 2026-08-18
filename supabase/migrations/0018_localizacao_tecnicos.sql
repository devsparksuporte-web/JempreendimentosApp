-- =====================================================================
-- JEmpreendimentos — Localização dos técnicos em tempo real
--
-- O painel de operação precisa mostrar onde cada técnico está. Até aqui a
-- tabela `technicians` guardava só o status, sem coordenada — então não
-- havia como posicioná-los no mapa. O app do técnico passa a reportar a
-- posição, e o administrador enxerga a equipe em campo.
--
-- Privacidade: a posição é da EQUIPE, não do cliente. Nenhum cliente lê
-- estes dados, e o técnico só escreve a própria linha.
-- =====================================================================

create table if not exists public.technician_locations (
  technician_id  uuid primary key references public.technicians(id) on delete cascade,
  latitude       numeric(10, 7) not null,
  longitude      numeric(10, 7) not null,
  -- Precisão em metros: permite ignorar posição ruim de rede na tela.
  accuracy       numeric(8, 2),
  heading        numeric(6, 2),
  speed          numeric(8, 2),
  updated_at     timestamptz not null default now()
);

-- O painel filtra por "quem reportou recentemente".
create index if not exists technician_locations_recentes_idx
  on public.technician_locations (updated_at desc);

-- ---------------------------------------------------------------------
-- O técnico reporta a própria posição
--
-- Via função, e não INSERT direto: assim o vínculo com o técnico logado é
-- garantido no servidor e ninguém consegue reportar posição por outro.
-- ---------------------------------------------------------------------
create or replace function public.report_technician_location(
  p_latitude  numeric,
  p_longitude numeric,
  p_accuracy  numeric default null,
  p_heading   numeric default null,
  p_speed     numeric default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_tech uuid := public.my_technician_id();
begin
  if v_tech is null then
    raise exception 'Apenas técnicos podem reportar localização.';
  end if;

  insert into public.technician_locations
    (technician_id, latitude, longitude, accuracy, heading, speed, updated_at)
  values (v_tech, p_latitude, p_longitude, p_accuracy, p_heading, p_speed, now())
  on conflict (technician_id) do update
    set latitude   = excluded.latitude,
        longitude  = excluded.longitude,
        accuracy   = excluded.accuracy,
        heading    = excluded.heading,
        speed      = excluded.speed,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.technician_locations enable row level security;

-- Admin vê a equipe toda; o técnico vê só a si mesmo. Cliente não vê nada.
drop policy if exists technician_locations_read on public.technician_locations;
create policy technician_locations_read on public.technician_locations
  for select using (
    public.is_admin() or technician_id = public.my_technician_id()
  );

-- Escrita só pela função acima (security definer), nunca direto.
drop policy if exists technician_locations_admin_write on public.technician_locations;
create policy technician_locations_admin_write on public.technician_locations
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on function public.report_technician_location(numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.report_technician_location(numeric, numeric, numeric, numeric, numeric) to authenticated;

-- Painel em tempo real
do $$ begin
  alter publication supabase_realtime add table public.technician_locations;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select 'technician_locations' as tabela,
       (select count(*) from public.technician_locations) as linhas,
       (select count(*) from pg_policies where tablename = 'technician_locations') as policies;
