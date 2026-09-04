-- ---------------------------------------------------------------------
-- 0036 — O aviso de agendamento chega a quem vai estar lá
--
-- SCHEDULE_CREATED, SCHEDULE_CHANGED e SCHEDULE_CANCELLED já existiam no
-- catálogo desde a 0022, mas caíam no bloco genérico da administração: o
-- título e o corpo vinham do metadata, e o cliente — a pessoa que precisa
-- saber que a visita mudou de dia — não recebia nada.
--
-- Este arquivo é a função da 0029 com UM ramo a mais, gerado a partir do
-- texto dela para que nenhuma outra linha mude por descuido de cópia.
-- ---------------------------------------------------------------------

create or replace function public.notificar_evento(
  p_evento      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_metadata    jsonb default '{}'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_call        public.service_calls%rowtype;
  v_cliente     uuid;
  v_tecnico     uuid;
  v_nome_cli    text;
  v_nome_tec    text;
  v_admin       uuid;
  v_titulo      text;
  v_corpo       text;
begin
  -- Contexto do chamado, quando o evento gira em torno de um.
  if p_entity_type = 'chamado' then
    select * into v_call from public.service_calls where id = p_entity_id;
    if not found then
      return;
    end if;

    select c.profile_id, c.name into v_cliente, v_nome_cli
      from public.clients c where c.id = v_call.client_id;

    if v_call.technician_id is not null then
      select t.profile_id, p.full_name into v_tecnico, v_nome_tec
        from public.technicians t
        join public.profiles p on p.id = t.profile_id
       where t.id = v_call.technician_id;
    end if;
  end if;

  -- -------------------------------------------------------------------
  -- Chamados
  -- -------------------------------------------------------------------
  if p_evento in ('NEW_TICKET', 'TICKET_URGENT') then
    v_titulo := case when p_evento = 'TICKET_URGENT' then 'Chamado urgente' else 'Novo chamado' end;
    v_corpo  := coalesce(v_nome_cli, 'Um cliente') || ' abriu o chamado #' || v_call.code || ': ' || v_call.title || '.';
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo, v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;
    -- O cliente recebe a confirmação de que o chamado entrou.
    perform public.notificar(v_cliente, p_evento, 'Chamado aberto',
      'Seu chamado #' || v_call.code || ' foi registrado com sucesso.', 'chamado', v_call.id, p_metadata);

  elsif p_evento = 'TICKET_ASSIGNED' then
    perform public.notificar(v_tecnico, p_evento, 'Novo atendimento',
      'Você recebeu o chamado #' || v_call.code || ' de ' || coalesce(v_nome_cli, 'um cliente') || '.',
      'chamado', v_call.id, p_metadata);
    perform public.notificar(v_cliente, p_evento, 'Técnico designado',
      'O técnico ' || coalesce(v_nome_tec, 'responsável') || ' foi designado para seu atendimento.',
      'chamado', v_call.id, p_metadata);

  elsif p_evento = 'TICKET_ACCEPTED' then
    v_corpo := coalesce(v_nome_tec, 'O técnico') || ' aceitou o chamado #' || v_call.code || '.';
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Técnico aceitou', v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_EN_ROUTE' then
    perform public.notificar(v_cliente, p_evento, 'Técnico a caminho',
      'O técnico ' || coalesce(v_nome_tec, 'responsável') || ' iniciou o deslocamento até seu endereço.',
      'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Deslocamento iniciado',
        coalesce(v_nome_tec, 'O técnico') || ' saiu para o chamado #' || v_call.code || '.',
        'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_STARTED' then
    perform public.notificar(v_cliente, p_evento, 'Atendimento iniciado',
      'O técnico iniciou o atendimento.', 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Atendimento iniciado',
        'Chamado #' || v_call.code || ' em execução.', 'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_FINISHED' then
    perform public.notificar(v_cliente, p_evento, 'Serviço concluído',
      'Seu atendimento foi finalizado.', 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Atendimento finalizado',
        'Chamado #' || v_call.code || ' concluído por ' || coalesce(v_nome_tec, 'técnico') || '.',
        'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_CANCELLED' then
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Chamado cancelado',
        'O chamado #' || v_call.code || ' foi cancelado.', 'chamado', v_call.id, p_metadata);
    end loop;
    perform public.notificar(v_tecnico, p_evento, 'Atendimento cancelado',
      'O chamado #' || v_call.code || ' foi cancelado.', 'chamado', v_call.id, p_metadata);
    perform public.notificar(v_cliente, p_evento, 'Chamado cancelado',
      'Seu chamado #' || v_call.code || ' foi cancelado.', 'chamado', v_call.id, p_metadata);

  elsif p_evento in ('TICKET_WAITING_PART', 'TICKET_WAITING_APPROVAL') then
    v_titulo := case p_evento
                  when 'TICKET_WAITING_PART' then 'Aguardando peça'
                  else 'Aguardando aprovação' end;
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo,
        'Chamado #' || v_call.code || ' parado: ' || lower(v_titulo) || '.',
        'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento = 'TICKET_RATED' then
    v_corpo := 'O cliente avaliou o chamado #' || v_call.code ||
               coalesce(' com ' || (p_metadata->>'rating') || ' estrela(s)', '') || '.';
    perform public.notificar(v_tecnico, p_evento, 'Avaliação recebida', v_corpo, 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, 'Avaliação recebida', v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;

  -- -------------------------------------------------------------------
  -- Mensagens: vai para o outro lado da conversa, nunca para quem escreveu
  -- -------------------------------------------------------------------
  elsif p_evento = 'MESSAGE_RECEIVED' then
    if (p_metadata->>'autor') = 'cliente' then
      perform public.notificar(v_tecnico, p_evento, 'Mensagem do cliente',
        coalesce(v_nome_cli, 'O cliente') || ' enviou uma mensagem no chamado #' || v_call.code || '.',
        'chamado', v_call.id, p_metadata);
      for v_admin in select public.perfis_admin() loop
        perform public.notificar(v_admin, p_evento, 'Mensagem do cliente',
          coalesce(v_nome_cli, 'O cliente') || ' escreveu no chamado #' || v_call.code || '.',
          'chamado', v_call.id, p_metadata);
      end loop;
    else
      perform public.notificar(v_cliente, p_evento, 'Mensagem da equipe',
        'Você recebeu uma mensagem sobre o chamado #' || v_call.code || '.',
        'chamado', v_call.id, p_metadata);
    end if;

  -- -------------------------------------------------------------------
  -- Estoque e financeiro: assunto da administração
  -- -------------------------------------------------------------------
  -- -------------------------------------------------------------------
  -- Agenda — quem precisa saber é quem vai estar lá
  --
  -- Antes estes três eventos caíam no bloco genérico da administração, com
  -- título e corpo vindos do metadata. Resultado: o cliente não era avisado
  -- de que a visita dele mudou de dia, que é exatamente a pessoa para quem
  -- isso importa.
  -- -------------------------------------------------------------------
  elsif p_evento in ('SCHEDULE_CREATED', 'SCHEDULE_CHANGED', 'SCHEDULE_CANCELLED')
        and p_entity_type = 'chamado' then
    v_titulo := case p_evento
                  when 'SCHEDULE_CREATED' then 'Visita agendada'
                  when 'SCHEDULE_CHANGED' then 'Visita remarcada'
                  else 'Agendamento cancelado'
                end;

    if p_evento = 'SCHEDULE_CANCELLED' then
      v_corpo := 'O agendamento do chamado #' || v_call.code ||
                 ' foi cancelado. Vamos combinar um novo horário.';
    else
      v_corpo := 'Chamado #' || v_call.code || ' — ' ||
                 to_char(v_call.scheduled_for at time zone
                   coalesce((select timezone from public.service_distribution_settings
                              where singleton limit 1), 'America/Sao_Paulo'),
                   'DD/MM/YYYY') || ' às ' ||
                 to_char(v_call.scheduled_for at time zone
                   coalesce((select timezone from public.service_distribution_settings
                              where singleton limit 1), 'America/Sao_Paulo'),
                   'HH24:MI') ||
                 coalesce(' com ' || v_nome_tec, '') || '.';
    end if;

    perform public.notificar(v_cliente, p_evento, v_titulo, v_corpo, 'chamado', v_call.id, p_metadata);
    perform public.notificar(v_tecnico, p_evento, v_titulo,
      coalesce(v_nome_cli, 'Um cliente') || ' — ' || v_corpo, 'chamado', v_call.id, p_metadata);
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo, v_corpo, 'chamado', v_call.id, p_metadata);
    end loop;

  elsif p_evento in ('STOCK_LOW', 'STOCK_ENTRY', 'STOCK_EXIT',
                     'REPLENISHMENT_CREATED', 'PURCHASE_CREATED', 'PURCHASE_RECEIVED',
                     'QUOTE_CREATED', 'QUOTE_APPROVED', 'QUOTE_REJECTED',
                     'PAYMENT_PENDING', 'PAYMENT_CONFIRMED',
                     'SCHEDULE_CREATED', 'SCHEDULE_CHANGED', 'SCHEDULE_CANCELLED',
                     'TECHNICIAN_AVAILABLE', 'TECHNICIAN_UNAVAILABLE') then
    v_titulo := coalesce(p_metadata->>'titulo', 'Atualização da operação');
    v_corpo  := coalesce(p_metadata->>'corpo', '');
    for v_admin in select public.perfis_admin() loop
      perform public.notificar(v_admin, p_evento, v_titulo, v_corpo, p_entity_type, p_entity_id, p_metadata);
    end loop;
  end if;
end;
$$;
