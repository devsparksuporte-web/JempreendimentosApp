/**
 * Triagem de chamado.
 *
 * ARQUITETURA (briefing, seção 34): a chave da API de IA NUNCA fica no app.
 * O caminho é APP -> BACKEND -> IA. Enquanto a Edge Function não existe, a
 * triagem roda como um roteiro estruturado local — mesmas perguntas, mesmo
 * resumo de saída, custo zero e sem chave exposta.
 *
 * Para plugar a IA real, implemente `askBackend` abaixo chamando a Edge
 * Function do Supabase (que guarda a chave no servidor) e troque o roteiro
 * pela resposta do modelo. O restante da tela não muda: ela consome
 * `TriagemStep` e devolve `TriagemResult`.
 */

export type TriagemOption = { value: string; label: string };

export type TriagemStep = {
  id: 'sintoma' | 'equipamento' | 'inicio' | 'codigo_erro';
  question: string;
  /** Opções de resposta rápida. Vazio = campo livre. */
  options: TriagemOption[];
  allowFreeText?: boolean;
};

export type TriagemAnswers = Partial<Record<TriagemStep['id'], string>>;

export type TriagemResult = {
  title: string;
  description: string;
  summary: {
    equipamento: string;
    sintoma: string;
    inicio: string;
    codigo_erro: string;
    resumo: string;
  };
};

export const SAUDACAO =
  'Olá! Sou a assistente da JEmpreendimentos. Vou fazer algumas perguntas rápidas ' +
  'para nossa equipe técnica já chegar preparada.';

const SINTOMAS: TriagemOption[] = [
  { value: 'Não está gelando', label: 'Não está gelando' },
  { value: 'Não liga', label: 'Não liga' },
  { value: 'Barulho anormal', label: 'Barulho anormal' },
  { value: 'Vazando água', label: 'Vazando água' },
  { value: 'Mau cheiro', label: 'Mau cheiro' },
  { value: 'Instalação nova', label: 'Instalação nova' },
];

const INICIOS: TriagemOption[] = [
  { value: 'Hoje', label: 'Hoje' },
  { value: 'Esta semana', label: 'Esta semana' },
  { value: 'Há mais de um mês', label: 'Há mais de um mês' },
];

const CODIGOS: TriagemOption[] = [
  { value: 'Não informado', label: 'Não aparece código' },
  { value: 'CH 01', label: 'CH 01' },
  { value: 'CH 05', label: 'CH 05' },
  { value: 'E1', label: 'E1' },
  { value: 'E5', label: 'E5' },
];

/**
 * Monta o roteiro. Os equipamentos do cliente viram opções da pergunta
 * "qual aparelho" — é o que permite vincular o chamado ao equipamento certo.
 */
export function buildTriagemSteps(equipamentos: TriagemOption[]): TriagemStep[] {
  const steps: TriagemStep[] = [
    {
      id: 'sintoma',
      question: 'O que está acontecendo com o aparelho?',
      options: SINTOMAS,
      allowFreeText: true,
    },
  ];

  if (equipamentos.length > 0) {
    steps.push({
      id: 'equipamento',
      question: 'Qual equipamento apresentou o problema?',
      options: equipamentos,
    });
  }

  steps.push(
    { id: 'inicio', question: 'Quando o problema começou?', options: INICIOS },
    {
      id: 'codigo_erro',
      question: 'O painel mostra algum código de erro?',
      options: CODIGOS,
      allowFreeText: true,
    },
  );

  return steps;
}

/** Resumo estruturado entregue ao técnico. */
export function buildTriagemResult(
  answers: TriagemAnswers,
  equipamentoLabel: string | null,
): TriagemResult {
  const sintoma = answers.sintoma ?? 'Não informado';
  const inicio = answers.inicio ?? 'Não informado';
  const codigo = answers.codigo_erro ?? 'Não informado';
  const equipamento = equipamentoLabel ?? 'Não informado';

  const resumo =
    `Cliente relatou: ${sintoma.toLowerCase()}. ` +
    `Equipamento: ${equipamento}. ` +
    `Início: ${inicio.toLowerCase()}. ` +
    `Código de erro: ${codigo === 'Não informado' ? 'não informado' : codigo}.`;

  return {
    title: sintoma,
    description: resumo,
    summary: { equipamento, sintoma, inicio, codigo_erro: codigo, resumo },
  };
}

/**
 * Seam para a IA real.
 *
 * Implementar como Edge Function do Supabase:
 *
 *   const { data, error } = await supabase.functions.invoke('ai-triagem', {
 *     body: { mensagens, equipamentos, clienteId },
 *   });
 *
 * A função no servidor é que guarda a chave, aplica limite de custo e grava
 * em ai_usage_logs. Nunca chamar o provedor de IA direto daqui.
 */
export async function askBackend(): Promise<never> {
  throw new Error(
    'IA de backend ainda não configurada. Implemente a Edge Function `ai-triagem` ' +
      'e chame-a aqui — a chave da IA não deve ficar no aplicativo.',
  );
}
