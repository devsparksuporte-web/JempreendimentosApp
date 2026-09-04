-- ---------------------------------------------------------------------
-- Teste da regra de conflito de agenda (migração 0034)
--
-- Rode no SQL Editor DEPOIS de aplicar a 0034. É todo dentro de uma
-- transação que termina em rollback: não deixa nada gravado.
--
-- Cada bloco imprime PASSOU ou FALHOU. Se algum imprimir FALHOU, me mande
-- a saída inteira.
-- ---------------------------------------------------------------------
begin;

do $$
declare
  v_tec   uuid;
  v_cli   uuid;
  v_a     uuid;
  v_b     uuid;
  v_base  timestamptz := date_trunc('hour', now()) + interval '30 days';
  v_erro  text;
begin
  select id into v_tec from public.technicians limit 1;
  select id into v_cli from public.clients limit 1;
  if v_tec is null or v_cli is null then
    raise notice 'PULADO — é preciso ao menos 1 técnico e 1 cliente cadastrados.';
    return;
  end if;

  insert into public.service_calls (client_id, title, description, service_type, priority, status, technician_id)
  values (v_cli, 'TESTE agenda A', 'teste', 'manutencao_corretiva', 'normal', 'tecnico_atribuido', v_tec)
  returning id into v_a;

  insert into public.service_calls (client_id, title, description, service_type, priority, status, technician_id)
  values (v_cli, 'TESTE agenda B', 'teste', 'manutencao_corretiva', 'normal', 'tecnico_atribuido', v_tec)
  returning id into v_b;

  -- 1) Primeiro agendamento: 14:00–15:00
  update public.service_calls
     set scheduled_for = v_base + interval '14 hours',
         scheduled_end = v_base + interval '15 hours'
   where id = v_a;
  raise notice 'PASSOU 1 — primeiro agendamento aceito (14:00-15:00).';

  -- 2) Mesmo horário no mesmo técnico: deve ser recusado
  begin
    update public.service_calls
       set scheduled_for = v_base + interval '14 hours',
           scheduled_end = v_base + interval '15 hours'
     where id = v_b;
    raise notice 'FALHOU 2 — o banco aceitou dois atendimentos às 14:00.';
  exception when exclusion_violation then
    raise notice 'PASSOU 2 — sobreposição exata recusada.';
  end;

  -- 3) Sobreposição parcial 14:30–15:30: deve ser recusada
  begin
    update public.service_calls
       set scheduled_for = v_base + interval '14 hours 30 minutes',
           scheduled_end = v_base + interval '15 hours 30 minutes'
     where id = v_b;
    raise notice 'FALHOU 3 — o banco aceitou 14:30 dentro de 14:00-15:00.';
  exception when exclusion_violation then
    raise notice 'PASSOU 3 — sobreposição parcial recusada.';
  end;

  -- 4) Encostado no fim, 15:00–16:00: deve ser ACEITO
  begin
    update public.service_calls
       set scheduled_for = v_base + interval '15 hours',
           scheduled_end = v_base + interval '16 hours'
     where id = v_b;
    raise notice 'PASSOU 4 — 15:00-16:00 aceito logo após 14:00-15:00.';
  exception when exclusion_violation then
    raise notice 'FALHOU 4 — recusou 15:00 sendo que o anterior termina às 15:00.';
  end;

  -- 5) Cancelar o chamado A libera o horário dele
  update public.service_calls set status = 'cancelado' where id = v_a;
  begin
    update public.service_calls
       set scheduled_for = v_base + interval '14 hours',
           scheduled_end = v_base + interval '15 hours'
     where id = v_b;
    raise notice 'PASSOU 5 — horário liberado depois do cancelamento.';
  exception when exclusion_violation then
    raise notice 'FALHOU 5 — o horário do chamado cancelado continua reservado.';
  end;

  -- 6) A função devolve a mensagem certa
  update public.service_calls set status = 'tecnico_atribuido' where id = v_a;
  update public.service_calls
     set scheduled_for = v_base + interval '9 hours',
         scheduled_end = v_base + interval '10 hours'
   where id = v_a;
  begin
    perform public.agendar_atendimento(v_b, v_base + interval '9 hours', 60, null);
    raise notice 'FALHOU 6 — agendar_atendimento aceitou horário ocupado.';
  exception
    when others then
      get stacked diagnostics v_erro = message_text;
      if v_erro like 'Este técnico já possui%' or v_erro like 'Não é possível reagendar%' then
        raise notice 'PASSOU 6 — mensagem devolvida: %', v_erro;
      else
        raise notice 'FALHOU 6 — mensagem inesperada: %', v_erro;
      end if;
  end;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- Concorrência de verdade (dois usuários ao mesmo tempo)
--
-- Não dá para provar numa aba só. Abra DUAS abas do SQL Editor e rode:
--
--   Aba 1:  begin;
--           select public.agendar_atendimento('<id-do-chamado-A>', '2026-09-10 14:00-03', 60, null);
--           -- NÃO commite ainda
--
--   Aba 2:  begin;
--           select public.agendar_atendimento('<id-do-chamado-B>', '2026-09-10 14:00-03', 60, null);
--           -- fica ESPERANDO — é o índice da constraint segurando
--
--   Aba 1:  commit;
--   Aba 2:  destrava e falha com "Este técnico já possui um atendimento…"
--
-- A espera na aba 2 é a prova: a checagem não é uma consulta anterior ao
-- update, é o próprio índice decidindo dentro da transação.
-- ---------------------------------------------------------------------
