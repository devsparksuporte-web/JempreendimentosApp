import { supabase } from '@/lib/supabase';

/**
 * Relatórios de performance da operação.
 *
 * Tudo aqui sai de `service_calls` e `service_ratings` — não há número
 * inventado nem meta fixa no código. O que o banco não sabe responder, a tela
 * mostra como vazio em vez de estimar.
 */

export type Periodo = 'mes' | 'ano';

export type PontoDoGrafico = {
  /** Rótulo curto do eixo (dia da semana ou mês). */
  rotulo: string;
  valor: number;
};

export type Relatorio = {
  periodo: Periodo;
  /** Atendimentos finalizados dentro do período. */
  concluidos: number;
  /** Mesmo intervalo, período imediatamente anterior — base da variação. */
  concluidosAnterior: number;
  /** Variação percentual contra o período anterior. Null sem base de comparação. */
  variacao: number | null;
  serie: PontoDoGrafico[];
  /** Média das notas dos chamados do período. Null se ninguém avaliou. */
  notaMedia: number | null;
  totalAvaliacoes: number;
  /** Duração média em minutos, de started_at até finished_at. */
  duracaoMediaMin: number | null;
};

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type CallRow = {
  id: string;
  started_at: string | null;
  finished_at: string | null;
};

/** Início da janela: 7 dias para o modo mês, 12 meses para o modo ano. */
function inicioDaJanela(periodo: Periodo, referencia: Date): Date {
  const d = new Date(referencia);
  if (periodo === 'mes') {
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setMonth(d.getMonth() - 11);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function montarSerie(periodo: Periodo, inicio: Date, fim: Date, linhas: CallRow[]): PontoDoGrafico[] {
  const baldes = new Map<string, PontoDoGrafico>();

  if (periodo === 'mes') {
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      baldes.set(d.toDateString(), { rotulo: DIAS[d.getDay()], valor: 0 });
    }
  } else {
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(inicio);
      d.setMonth(inicio.getMonth() + i);
      baldes.set(`${d.getFullYear()}-${d.getMonth()}`, { rotulo: MESES[d.getMonth()], valor: 0 });
    }
  }

  for (const linha of linhas) {
    if (!linha.finished_at) continue;
    const d = new Date(linha.finished_at);
    if (d < inicio || d > fim) continue;
    const chave = periodo === 'mes' ? d.toDateString() : `${d.getFullYear()}-${d.getMonth()}`;
    const balde = baldes.get(chave);
    if (balde) balde.valor += 1;
  }

  return [...baldes.values()];
}

export async function fetchRelatorio(periodo: Periodo = 'mes'): Promise<Relatorio> {
  const agora = new Date();
  const inicio = inicioDaJanela(periodo, agora);

  // Janela anterior de mesmo tamanho, para a variação ter com o que comparar.
  const duracaoJanela = agora.getTime() - inicio.getTime();
  const inicioAnterior = new Date(inicio.getTime() - duracaoJanela);

  const { data, error } = await supabase
    .from('service_calls')
    .select('id, started_at, finished_at')
    .eq('status', 'finalizado')
    .gte('finished_at', inicioAnterior.toISOString())
    .order('finished_at', { ascending: true })
    .limit(2000);

  if (error) throw new Error(error.message);

  const todas = (data ?? []) as CallRow[];
  const doPeriodo = todas.filter((c) => c.finished_at && new Date(c.finished_at) >= inicio);
  const anteriores = todas.filter(
    (c) => c.finished_at && new Date(c.finished_at) < inicio && new Date(c.finished_at) >= inicioAnterior,
  );

  // Duração média só considera chamados com os dois carimbos de hora.
  const duracoes = doPeriodo
    .filter((c) => c.started_at && c.finished_at)
    .map((c) => new Date(c.finished_at!).getTime() - new Date(c.started_at!).getTime())
    .filter((ms) => ms > 0);

  const duracaoMediaMin = duracoes.length
    ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length / 60000)
    : null;

  // Notas dos chamados do período.
  let notaMedia: number | null = null;
  let totalAvaliacoes = 0;
  if (doPeriodo.length) {
    const { data: notas } = await (supabase as any)
      .from('service_ratings')
      .select('rating, service_call_id')
      .in(
        'service_call_id',
        doPeriodo.map((c) => c.id),
      );
    const lista = ((notas ?? []) as { rating: number }[]).map((n) => Number(n.rating));
    totalAvaliacoes = lista.length;
    if (lista.length) {
      notaMedia = Math.round((lista.reduce((a, b) => a + b, 0) / lista.length) * 10) / 10;
    }
  }

  const variacao = anteriores.length
    ? Math.round(((doPeriodo.length - anteriores.length) / anteriores.length) * 100)
    : null;

  return {
    periodo,
    concluidos: doPeriodo.length,
    concluidosAnterior: anteriores.length,
    variacao,
    serie: montarSerie(periodo, inicio, agora, doPeriodo),
    notaMedia,
    totalAvaliacoes,
    duracaoMediaMin,
  };
}

/** "1h 20min" lê melhor que "80 min" na tela. */
export function formatarDuracaoMin(minutos: number | null): string {
  if (minutos === null) return '—';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
