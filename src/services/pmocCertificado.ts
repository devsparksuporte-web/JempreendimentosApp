import * as Print from 'expo-print';

import { entregarPdf } from '@/services/documento';
import { execucoesNoPeriodo, type PmocCertificate, type PmocPlan } from '@/services/pmoc';
import { colors } from '@/theme/tokens';

/**
 * Certificado de execução do PMOC.
 *
 * A fiscalização sanitária aceita o documento impresso, então o formato é A4
 * e o conteúdo carrega o que ela cobra: identificação do estabelecimento,
 * responsável técnico, relação dos equipamentos, rotinas com periodicidade e
 * o registro datado de cada execução no período.
 */

const dataBR = (valor: string | null | undefined) => {
  if (!valor) return '—';
  // Data pura ('2026-01-15') lida por new Date() vira meia-noite UTC e, no
  // fuso de Brasília, volta um dia. O período do certificado é justamente
  // um par de datas puras.
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

/** O HTML é montado por concatenação, então todo texto do banco é escapado. */
const escapar = (valor: string | null | undefined) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function equipamentoNome(e: PmocPlan['items'][number]['equipment']): string {
  if (!e) return 'Equipamento não informado';
  const btu = e.btu_capacity ? ' ' + e.btu_capacity.toLocaleString('pt-BR') + ' BTUs' : '';
  return (e.brand ?? 'Equipamento') + btu;
}

function enderecoCompleto(plan: PmocPlan): string {
  const a = plan.address;
  if (!a) return 'Endereço não informado';
  return [
    a.street + (a.number ? ', ' + a.number : ''),
    a.district,
    a.city + (a.state ? ' / ' + a.state : ''),
    a.zip_code ? 'CEP ' + a.zip_code : null,
  ]
    .filter(Boolean)
    .join(' — ');
}

function estilos(): string {
  return [
    '@page { size: A4; margin: 18mm 14mm; }',
    '* { box-sizing: border-box; }',
    'body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11px; color: ' + colors.textPrimary + '; }',
    '.topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ' + colors.brand + '; padding-bottom: 12px; margin-bottom: 18px; }',
    '.marca { font-size: 20px; font-weight: 800; letter-spacing: 1px; color: ' + colors.brandStrong + '; }',
    '.marca span { display: block; font-size: 9px; font-weight: 700; letter-spacing: 2px; color: ' + colors.brand + '; margin-top: 2px; }',
    '.numero { text-align: right; }',
    '.numero b { display: block; font-size: 15px; color: ' + colors.brandStrong + '; }',
    '.numero small { color: ' + colors.textSecondary + '; }',
    'h1 { font-size: 15px; text-align: center; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; color: ' + colors.brandStrong + '; }',
    '.sub { text-align: center; font-size: 10px; margin-bottom: 18px; color: ' + colors.textSecondary + '; }',
    'h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.4px; margin: 18px 0 6px; color: ' + colors.textSecondary + '; }',
    '.caixa { border: 1px solid ' + colors.border + '; border-radius: 6px; padding: 10px 12px; }',
    '.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }',
    '.campo b { color: ' + colors.textSecondary + '; font-weight: 700; }',
    '.largo { grid-column: 1 / -1; }',
    'table { width: 100%; border-collapse: collapse; margin-top: 4px; }',
    'th { background: ' + colors.brandTint + '; color: ' + colors.brandStrong + '; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; text-align: left; padding: 6px 8px; }',
    'td { padding: 6px 8px; border-bottom: 1px solid ' + colors.border + '; }',
    '.center { text-align: center; }',
    '.vazio { font-style: italic; color: ' + colors.textMuted + '; }',
    '.declaracao { margin-top: 18px; line-height: 1.6; text-align: justify; }',
    '.assinaturas { margin-top: 42px; display: flex; gap: 40px; }',
    '.assinatura { flex: 1; text-align: center; }',
    '.linha { border-top: 1px solid ' + colors.textPrimary + '; margin-bottom: 4px; }',
    '.assinatura small { color: ' + colors.textSecondary + '; }',
    'footer { margin-top: 26px; border-top: 1px solid ' + colors.border + '; padding-top: 8px; font-size: 8px; text-align: center; color: ' + colors.textMuted + '; }',
  ].join('\n');
}

function linhasEquipamentos(plan: PmocPlan): string {
  return plan.items
    .map((item) =>
      [
        '<tr>',
        '<td>' + escapar(equipamentoNome(item.equipment)) + '</td>',
        '<td>' + escapar(item.equipment?.environment ?? '—') + '</td>',
        '<td>' + escapar(item.equipment?.serial_number ?? '—') + '</td>',
        '<td>' + escapar(item.routine) + '</td>',
        '<td class="center">' + item.frequency_months + (item.frequency_months === 1 ? ' mês' : ' meses') + '</td>',
        '</tr>',
      ].join(''),
    )
    .join('');
}

function linhasExecucoes(plan: PmocPlan, certificado: PmocCertificate): string {
  const registros = execucoesNoPeriodo(plan, certificado.period_start, certificado.period_end);

  if (registros.length === 0) {
    return '<tr><td colspan="5" class="center vazio">Nenhuma execução registrada no período.</td></tr>';
  }

  return registros
    .map(({ item, execucao }) => {
      const ambiente = item.equipment?.environment ? ' — ' + escapar(item.equipment.environment) : '';
      return [
        '<tr>',
        '<td class="center">' + dataBR(execucao.executed_at) + '</td>',
        '<td>' + escapar(equipamentoNome(item.equipment)) + ambiente + '</td>',
        '<td>' + escapar(item.routine) + '</td>',
        '<td class="center">' + (execucao.conforme ? 'Conforme' : 'Não conforme') + '</td>',
        '<td>' + escapar(execucao.technician?.profile?.full_name ?? '—') + '</td>',
        '</tr>',
      ].join('');
    })
    .join('');
}

export function montarHtml(plan: PmocPlan, certificado: PmocCertificate): string {
  const total = execucoesNoPeriodo(plan, certificado.period_start, certificado.period_end).length;
  const registro = certificado.responsible_registration;

  return [
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />',
    '<style>' + estilos() + '</style></head><body>',

    '<div class="topo">',
    '<div class="marca">JEMPREENDIMENTOS<span>CLIMATIZAÇÃO E SERVIÇOS</span></div>',
    '<div class="numero"><b>' + escapar(certificado.number) + '</b>',
    '<small>Emitido em ' + dataBR(certificado.issued_at) + '</small></div>',
    '</div>',

    '<h1>Certificado de Execução do PMOC</h1>',
    '<p class="sub">Plano de Manutenção, Operação e Controle — Portaria MS nº 3.523/1998 e RE ANVISA nº 09/2003</p>',

    '<h2>Estabelecimento</h2>',
    '<div class="caixa grid">',
    '<div class="campo"><b>Cliente:</b> ' + escapar(plan.client?.name ?? '—') + '</div>',
    '<div class="campo"><b>CNPJ/CPF:</b> ' + escapar(plan.client?.doc ?? '—') + '</div>',
    '<div class="campo largo"><b>Endereço:</b> ' + escapar(enderecoCompleto(plan)) + '</div>',
    '<div class="campo"><b>Plano:</b> ' + escapar(plan.title) + '</div>',
    '<div class="campo"><b>Vigência:</b> ' + dataBR(plan.start_date) + ' a ' + (plan.end_date ? dataBR(plan.end_date) : 'indeterminada') + '</div>',
    '</div>',

    '<h2>Responsável Técnico</h2>',
    '<div class="caixa grid">',
    '<div class="campo"><b>Nome:</b> ' + escapar(certificado.responsible_name) + '</div>',
    '<div class="campo"><b>Registro:</b> ' + escapar(registro ?? '—') + '</div>',
    '<div class="campo largo"><b>Período certificado:</b> ' + dataBR(certificado.period_start) + ' a ' + dataBR(certificado.period_end) + '</div>',
    '</div>',

    '<h2>Equipamentos e rotinas do plano</h2>',
    '<table><thead><tr><th>Equipamento</th><th>Ambiente</th><th>Nº de série</th><th>Rotina</th><th class="center">Periodicidade</th></tr></thead>',
    '<tbody>' + linhasEquipamentos(plan) + '</tbody></table>',

    '<h2>Execuções registradas no período (' + total + ')</h2>',
    '<table><thead><tr><th class="center">Data</th><th>Equipamento</th><th>Rotina</th><th class="center">Resultado</th><th>Executado por</th></tr></thead>',
    '<tbody>' + linhasExecucoes(plan, certificado) + '</tbody></table>',

    '<p class="declaracao">Declaramos, para os devidos fins e a quem possa interessar, que os ',
    'equipamentos de climatização relacionados neste documento foram submetidos às rotinas de ',
    'manutenção, operação e controle previstas no respectivo PMOC, no período indicado, conforme ',
    'os registros acima, atendendo à legislação sanitária vigente.</p>',

    '<div class="assinaturas">',
    '<div class="assinatura"><div class="linha"></div><b>' + escapar(certificado.responsible_name) + '</b><br />',
    '<small>Responsável Técnico' + (registro ? ' — ' + escapar(registro) : '') + '</small></div>',
    '<div class="assinatura"><div class="linha"></div><b>' + escapar(certificado.signer_name ?? plan.client?.name ?? '') + '</b><br />',
    '<small>Responsável pelo estabelecimento</small></div>',
    '</div>',

    '<footer>Documento ' + escapar(certificado.number) + ' gerado eletronicamente pelo sistema ',
    'JEmpreendimentos. A autenticidade pode ser conferida junto à empresa emissora.</footer>',

    '</body></html>',
  ].join('');
}

/** Gera o PDF e abre o compartilhamento (imprimir, salvar, enviar). */
export async function gerarPdf(
  plan: PmocPlan,
  certificado: PmocCertificate,
): Promise<string | null> {
  return entregarPdf(montarHtml(plan, certificado), 'Certificado ' + certificado.number);
}

/** Envia direto para a impressora, sem passar pelo compartilhamento. */
export async function imprimir(plan: PmocPlan, certificado: PmocCertificate): Promise<void> {
  await Print.printAsync({ html: montarHtml(plan, certificado) });
}
