import * as Print from 'expo-print';

import { entregarPdf } from '@/services/documento';
import {
  agruparPorGrupo,
  ROTULO_PERIODICIDADE,
  type PmocPlan,
  type RotinaDoCatalogo,
} from '@/services/pmoc';

/**
 * O documento do PMOC.
 *
 * Não confundir com o certificado: aquele prova o que FOI executado num
 * período; este é o plano em si, o papel que fica na unidade e que a
 * fiscalização pede para ver junto com a ordem de serviço.
 *
 * A estrutura segue o modelo da Portaria 3.523/98 — as cinco seções na
 * ordem, com a tabela de rotinas agrupada pelos 12 grupos e a periodicidade
 * em letra. Campo sem preenchimento sai em branco de propósito: um traço
 * inventado num documento oficial é pior que a lacuna, porque esconde que
 * falta informação.
 */

const dataBR = (valor: string | null | undefined) => {
  if (!valor) return '';
  // Data pura ('2026-01-15') não pode passar por new Date(): o JavaScript a
  // lê como meia-noite UTC e, no fuso de Brasília, devolve o dia anterior.
  // Num documento que vai para a fiscalização, um dia de diferença na data
  // de início de contrato é erro de verdade.
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

/** O HTML é montado por concatenação, então todo texto do banco é escapado. */
const escapar = (valor: string | number | null | undefined) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const numeroBR = (valor: number | null | undefined, casas = 0) =>
  valor === null || valor === undefined
    ? ''
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function celula(rotulo: string, valor: string, largura?: string): string {
  return (
    '<td' +
    (largura ? ' style="width:' + largura + '"' : '') +
    '><span class="rot">' +
    escapar(rotulo) +
    '</span><div class="val">' +
    valor +
    '</div></td>'
  );
}

function secao1(plan: PmocPlan, telefone: string): string {
  const a = plan.address;
  return [
    '<h2>1 - IDENTIFICAÇÃO DO AMBIENTE OU CONJUNTO DE AMBIENTES</h2>',
    '<table class="quadro">',
    '<tr>' + celula('NOME ( EDIFÍCIO/ENTIDADE )', escapar(plan.client?.name)) + '</tr>',
    '<tr>' +
      celula('ENDEREÇO COMPLETO', escapar(a?.street), '80%') +
      celula('Nº', escapar(a?.number)) +
      '</tr>',
    '<tr>' +
      celula('COMPLEMENTO', '', '25%') +
      celula('BAIRRO', escapar(a?.district), '25%') +
      celula('CIDADE', escapar(a?.city), '35%') +
      celula('UF', escapar(a?.state)) +
      '</tr>',
    '<tr>' +
      celula('TELEFONE', escapar(telefone), '33%') +
      celula('FAX', '', '33%') +
      celula('FILIAL', 'Nenhuma') +
      '</tr>',
    '</table>',
  ].join('');
}

function secao2(plan: PmocPlan): string {
  const a = plan.address;
  const endereco = [a?.street, a?.number, a?.district, a?.city, a?.state]
    .filter(Boolean)
    .join(', ');
  return [
    '<h2>2 – IDENTIFICAÇÃO PROPRIETÁRIO, LOCATÁRIO OU PREPOSTO</h2>',
    '<table class="quadro">',
    '<tr>' +
      celula('NOME/RAZÃO SOCIAL', escapar(plan.client?.name), '55%') +
      celula('CPF/CNPJ', escapar(plan.client?.doc)) +
      '</tr>',
    '<tr>' +
      celula('ENDEREÇO COMPLETO', escapar(endereco), '55%') +
      celula('TEL/FAX', '') +
      '</tr>',
    '</table>',
  ].join('');
}

function secao3(plan: PmocPlan, empresa: DadosDaEmpresa): string {
  const r = plan.responsible;
  return [
    '<h2>3 – IDENTIFICAÇÃO DO RESPONSÁVEL TÉCNICO :</h2>',
    '<table class="quadro">',
    '<tr>' +
      celula('NOME/RAZÃO SOCIAL', escapar(r?.profile?.full_name ?? empresa.razaoSocial), '55%') +
      celula('CPF/CNPJ', escapar(empresa.cnpj)) +
      '</tr>',
    '<tr>' +
      celula('ENDEREÇO COMPLETO', escapar(empresa.endereco), '55%') +
      celula('TEL/FAX', escapar(empresa.telefone)) +
      '</tr>',
    '<tr>' +
      celula('REGISTRO NO CONSELHO DE CLASSE', escapar(r?.council_registration), '55%') +
      celula('ART / TRT', escapar(plan.art_trt)) +
      '</tr>',
    '<tr>' +
      celula('DATA DO INÍCIO DO CONTRATO', dataBR(plan.start_date), '55%') +
      celula('PRAZO', escapar(plan.contract_term)) +
      '</tr>',
    '<tr>' + celula('DATA DE TÉRMINO DO CONTRATO', dataBR(plan.end_date), '55%') + '</tr>',
    '</table>',
  ].join('');
}

function secao4(plan: PmocPlan): string {
  const ambientes = [...(plan.environments ?? [])].sort((a, b) => a.ordem - b.ordem);

  const linhas = ambientes.length
    ? ambientes
        .map((e) =>
          [
            '<tr>',
            '<td>' + escapar(e.activity) + '</td>',
            '<td class="center">' + escapar(e.occupants_fixed) + '</td>',
            '<td class="center">' + escapar(e.occupants_floating) + '</td>',
            '<td>' + escapar(e.name) + '</td>',
            '<td class="center">' + (e.area_m2 ? numeroBR(e.area_m2, 0) + 'm²' : '') + '</td>',
            '<td class="center">' + numeroBR(e.thermal_load_btu) + '</td>',
            '</tr>',
          ].join(''),
        )
        .join('')
    : '<tr><td colspan="6" class="center vazio">Nenhum ambiente cadastrado neste plano.</td></tr>';

  return [
    '<h2>4 – RELAÇÃO DOS AMBIENTES CLIMATIZADOS :</h2>',
    '<table class="grade">',
    '<thead><tr>',
    '<th rowspan="2">TIPO DE ATIVIDADE</th>',
    '<th colspan="2">Nº DE OCUPANTES</th>',
    '<th rowspan="2">IDENTIFICAÇÃO DO AMBIENTE</th>',
    '<th rowspan="2">ÁREA TOTAL</th>',
    '<th rowspan="2">CARGA TÉRMICA</th>',
    '</tr><tr><th>FIXOS</th><th>FLUTUANTES</th></tr></thead>',
    '<tbody>' + linhas + '</tbody>',
    '</table>',
  ].join('');
}

function secao5(plan: PmocPlan, catalogo: RotinaDoCatalogo[]): string {
  const grupos = agruparPorGrupo(plan.items ?? [], catalogo);

  const corpo = grupos.length
    ? grupos
        .map((g) =>
          [
            '<tr class="grupo"><td class="center">' + g.numero + '</td><td>' + escapar(g.nome) + '</td><td></td></tr>',
            ...g.linhas.map(
              (l) =>
                '<tr><td class="center">' +
                escapar(l.code) +
                '</td><td>' +
                escapar(l.descricao) +
                '</td><td class="center">' +
                escapar(l.periodicidade) +
                '</td></tr>',
            ),
          ].join(''),
        )
        .join('')
    : '<tr><td colspan="3" class="center vazio">Nenhuma rotina do catálogo aplicada a este plano.</td></tr>';

  return [
    '<h2>5 - PLANO DE MANUTENÇÃO, OPERAÇÃO E CONTROLE</h2>',
    '<p class="sub">I – CONDICIONADORES DE JANELA E MINI SPLITS INSTALADOS NO AMBIENTE CLIMATIZADO</p>',
    '<p class="legenda">Q - quinzenal &nbsp; M – mensal &nbsp; B - bimestral &nbsp; T – trimestral &nbsp; S – semestral &nbsp; A - anual</p>',
    '<table class="grade rotinas">',
    '<thead><tr><th>ITEM</th><th>DESCRIÇÃO DO SERVIÇOS</th><th>PERIODICIDADE</th></tr></thead>',
    '<tbody>' + corpo + '</tbody>',
    '</table>',
    '<table class="quadro assinatura">',
    '<tr><td>DATA DE EXECUÇÃO: VIDE ORDEM DE SERVIÇO</td></tr>',
    '<tr><td>EXECUTADO POR: (RESPONSÁVEL) VIDE ORDEM DE SERVIÇO</td></tr>',
    '<tr><td>APROVADO POR: ASSINATURA DO RESPONSÁVEL (VIDE ORDEM DE SERVIÇO)</td></tr>',
    '</table>',
  ].join('');
}

const OBSERVACOES = [
  'Em locais críticos, a periodicidade deve ser reduzida, tais como as de limpeza dos filtros, evaporadores, etc, de modo a manter o equipamento em perfeito estado de conservação e funcionamento.',
  'Todos os produtos utilizados na limpeza dos componentes dos sistemas de climatização, devem ser biodegradáveis e estarem devidamente registrados no Ministério da Saúde para esse fim.',
  'Serviços não constantes deste PMOC, mas previstos no manual do fabricante do equipamento, também deverão ser realizados e registrados.',
  'Os registros deverão ser efetuados nas planilhas dos relatórios de inspeção, medição e pendências, padrão.',
  'As rotinas serão executadas de acordo com o tipo de sistema.',
  'É obrigatório anexar a ordem de serviço ao PMOC, mantendo ambos na Unidade.',
];

/**
 * Dados da prestadora que aparecem na seção 3.
 *
 * Ficam como parâmetro em vez de constante no código: CNPJ, endereço e
 * telefone da empresa são informação comercial, e inventá-los num documento
 * que vai para a fiscalização seria pior que deixar em branco.
 */
export type DadosDaEmpresa = {
  razaoSocial?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
};

export function montarHtml(
  plan: PmocPlan,
  catalogo: RotinaDoCatalogo[],
  empresa: DadosDaEmpresa = {},
  telefoneCliente = '',
): string {
  return [
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />',
    '<style>' + estilos() + '</style></head><body>',
    '<h1>PMOC</h1>',
    secao1(plan, telefoneCliente),
    secao2(plan),
    secao3(plan, empresa),
    secao4(plan),
    secao5(plan, catalogo),
    '<div class="obs"><b>OBSERVAÇÕES:</b><ol>' +
      OBSERVACOES.map((o) => '<li>' + escapar(o) + '</li>').join('') +
      '</ol></div>',
    '</body></html>',
  ].join('');
}

/** Gera o PDF e abre o compartilhamento (imprimir, salvar, enviar). */
export async function gerarPdf(
  plan: PmocPlan,
  catalogo: RotinaDoCatalogo[],
  empresa?: DadosDaEmpresa,
  telefoneCliente?: string,
): Promise<string | null> {
  return entregarPdf(
    montarHtml(plan, catalogo, empresa, telefoneCliente),
    'PMOC ' + (plan.client?.name ?? plan.title),
  );
}

export async function imprimir(
  plan: PmocPlan,
  catalogo: RotinaDoCatalogo[],
  empresa?: DadosDaEmpresa,
  telefoneCliente?: string,
): Promise<void> {
  await Print.printAsync({ html: montarHtml(plan, catalogo, empresa, telefoneCliente) });
}

/** Rótulo por extenso da letra, para as telas. */
export function periodicidadePorExtenso(codigo: string | null): string {
  return codigo ? (ROTULO_PERIODICIDADE[codigo] ?? codigo) : '';
}

function estilos(): string {
  return `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
         color: #111; font-size: 10.5px; margin: 0; }
  h1 { text-align: center; font-size: 17px; margin: 0 0 10px; letter-spacing: .5px; }
  h2 { font-size: 11px; margin: 14px 0 4px; }
  p.sub { font-size: 10.5px; font-weight: 700; margin: 8px 0 2px; }
  p.legenda { font-size: 10px; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  .quadro td { border: 1px solid #9aa4b2; padding: 3px 5px; vertical-align: top; height: 34px; }
  .rot { display: block; font-size: 7.5px; color: #5b6675; letter-spacing: .2px; }
  .val { font-size: 12px; padding-top: 1px; }
  .grade th, .grade td { border: 1px solid #9aa4b2; padding: 4px 5px; }
  .grade th { background: #f1f5f9; font-size: 8px; text-align: left; font-weight: 600; }
  .center { text-align: center; }
  .vazio { color: #6b7280; font-style: italic; padding: 10px 0; }
  .rotinas td { font-size: 10px; }
  .rotinas tr.grupo td { background: #f8fafc; font-weight: 700; }
  .rotinas th:first-child, .rotinas td:first-child { width: 42px; }
  .rotinas th:last-child, .rotinas td:last-child { width: 96px; text-align: center; }
  .assinatura td { height: 22px; font-size: 10px; }
  .obs { margin-top: 12px; font-size: 10px; }
  .obs ol { margin: 4px 0 0 16px; padding: 0; }
  .obs li { margin-bottom: 3px; }
  `;
}
