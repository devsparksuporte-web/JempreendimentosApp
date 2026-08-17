create or replace function public.learn_service_call_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes numeric;
begin
  if old.status is distinct from new.status and new.status = 'finalizado' and new.started_at is not null and new.finished_at is not null and new.technician_id is not null then
    v_minutes := greatest(1, extract(epoch from (new.finished_at - new.started_at)) / 60);
    insert into public.technician_service_durations (technician_id, service_type, observed_average_minutes, observed_count)
    values (new.technician_id, new.service_type, v_minutes, 1)
    on conflict (technician_id, service_type) do update set
      observed_average_minutes = ((technician_service_durations.observed_average_minutes * technician_service_durations.observed_count) + excluded.observed_average_minutes) / (technician_service_durations.observed_count + 1),
      observed_count = technician_service_durations.observed_count + 1,
      updated_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.learn_service_call_duration() from public, anon, authenticated;
