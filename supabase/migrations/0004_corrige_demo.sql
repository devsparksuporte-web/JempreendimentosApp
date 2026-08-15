-- =====================================================================
-- JEmpreendimentos — Correção da função de demonstração
--
-- Rode UMA VEZ, depois de 0003. Seguro repetir.
--
-- A versão anterior criava o chamado já em "a_caminho", então o trigger
-- de histórico registrava essa transição e a etapa "Aberto" ficava sem
-- horário na timeline, além de gerar uma linha duplicada. Agora o chamado
-- nasce aberto e percorre os status, deixando o trigger montar o
-- histórico real.
--
-- Substitui apenas a função. Nenhuma tabela é alterada.
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
