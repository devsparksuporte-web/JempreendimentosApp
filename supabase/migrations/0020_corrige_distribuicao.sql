-- =====================================================================
-- JEmpreendimentos — Correção da distribuição automática
--
-- Dois defeitos apareceram na primeira vez que um técnico ficou elegível:
--
-- 1) `format('... %.2f ...', ...)` em distribute_service_call. O format()
--    do Postgres aceita só %s, %I, %L e %% — não existe precisão no estilo
--    printf. O '.' era lido como especificador e derrubava a função com
--    "unrecognized format() type specifier". Como a linha fica no caminho
--    de SUCESSO (depois de escolher o técnico), o defeito ficou latente
--    enquanto nenhum candidato era elegível.
--
-- 2) Dois gatilhos AFTER INSERT chamando a mesma distribuição:
--    `service_calls_auto_assign` (0008), sem tratamento de erro, e
--    `service_calls_auto_distribute` (0017), com tratamento. O primeiro
--    deixava a exceção subir e abortava a criação do chamado, anulando a
--    proteção do segundo. Fica só o da 0017.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Conserta o format() dentro de distribute_service_call
--
-- A função tem quase cem linhas de cálculo de pontuação. Reescrevê-la
-- inteira aqui só para trocar uma linha convidaria a erro de transcrição,
-- então a correção é cirúrgica: lê a definição atual do catálogo, troca o
-- trecho defeituoso e recria. Se o trecho não estiver lá — porque alguém
-- já corrigiu ou a função mudou —, a migration PARA com erro em vez de
-- seguir em silêncio achando que consertou.
-- ---------------------------------------------------------------------
do $fix$
declare
  v_def  text;
  v_novo text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'distribute_service_call';

  if v_def is null then
    raise exception 'distribute_service_call não existe neste banco.';
  end if;

  -- Troca o especificador inválido por %s.
  v_novo := replace(v_def, 'com %.2f pontos', 'com %s pontos');
  if v_novo = v_def then
    raise exception
      'Trecho "com %%.2f pontos" não encontrado em distribute_service_call. '
      'A função já foi corrigida ou mudou — confira antes de rodar de novo.';
  end if;

  -- E formata o número no argumento, mantendo as duas casas que o %.2f prometia.
  v_def  := v_novo;
  v_novo := replace(
    v_def,
    'v_best_name, v_best_score));',
    'v_best_name, trim(to_char(v_best_score, ''FM990.00''))));'
  );
  if v_novo = v_def then
    raise exception
      'Argumento "v_best_name, v_best_score" não encontrado. Correção abortada.';
  end if;

  execute v_novo;
end
$fix$;

-- ---------------------------------------------------------------------
-- 2) Um gatilho só, e o que sobrevive é o que engole o erro
--
-- A distribuição é um ganho, não um requisito: se ela falhar, o chamado
-- precisa continuar existindo para alguém atribuir na mão. Só o gatilho
-- da 0017 tem essa proteção.
-- ---------------------------------------------------------------------
drop trigger if exists service_calls_auto_assign on public.service_calls;

-- A função `auto_assign_service_call_trigger` fica no banco sem uso. Não
-- removo aqui para não mexer em dependências que não preciso tocar agora;
-- sem gatilho, ela simplesmente não é chamada.

-- ---------------------------------------------------------------------
-- 3) Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from pg_trigger
    where tgrelid = 'public.service_calls'::regclass
      and tgname = 'service_calls_auto_assign')      as gatilho_antigo_deve_ser_0,
  (select count(*) from pg_trigger
    where tgrelid = 'public.service_calls'::regclass
      and tgname = 'service_calls_auto_distribute')  as gatilho_novo_deve_ser_1,
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'distribute_service_call'
      and pg_get_functiondef(p.oid) like '%\%.2f%')  as format_defeituoso_deve_ser_0;
