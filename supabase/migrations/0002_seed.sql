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
