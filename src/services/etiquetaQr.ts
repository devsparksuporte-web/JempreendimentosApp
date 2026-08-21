import * as Print from 'expo-print';
import QRCode from 'qrcode';

import { entregarPdf } from '@/services/documento';

/**
 * Etiqueta de QR Code do equipamento.
 *
 * O QR é gerado como SVG embutido no próprio HTML. Nada é buscado na
 * internet: a etiqueta precisa sair na obra, e obra costuma ser onde o sinal
 * não chega.
 *
 * Sobre impressora Bluetooth: o `expo-print` fala com o sistema de impressão
 * do Android, e só enxerga impressora que tenha serviço de impressão
 * instalado. A maioria das térmicas baratas de 58 mm não tem — elas usam o
 * aplicativo do próprio fabricante, por ESC/POS. Por isso existem dois
 * caminhos aqui: imprimir pelo sistema e exportar PDF para compartilhar com
 * o aplicativo da impressora.
 */

export type DadosEtiqueta = {
  /** Conteúdo que o leitor do técnico espera encontrar. */
  conteudo: string;
  titulo: string;
  linha1?: string | null;
  linha2?: string | null;
};

/** Largura padrão de bobina térmica pequena. */
const LARGURA_MM = 58;

async function svgDoQr(conteudo: string): Promise<string> {
  return QRCode.toString(conteudo, {
    type: 'svg',
    // Correção alta: etiqueta em ambiente de obra suja, arranha e desbota.
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 160,
  });
}

function montarHtml(svg: string, dados: DadosEtiqueta, copias: number): string {
  const etiqueta = `
    <div class="etiqueta">
      <div class="qr">${svg}</div>
      <div class="titulo">${escapar(dados.titulo)}</div>
      ${dados.linha1 ? `<div class="linha">${escapar(dados.linha1)}</div>` : ''}
      ${dados.linha2 ? `<div class="linha">${escapar(dados.linha2)}</div>` : ''}
      <div class="marca">JEMPREENDIMENTOS</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  @page { size: ${LARGURA_MM}mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
  }
  .etiqueta {
    width: ${LARGURA_MM - 4}mm;
    padding: 2mm 0 4mm;
    text-align: center;
    page-break-after: always;
  }
  .etiqueta:last-child { page-break-after: auto; }
  .qr svg { width: 40mm; height: 40mm; }
  .titulo { font-size: 9pt; font-weight: 700; margin-top: 1mm; line-height: 1.2; }
  .linha { font-size: 7pt; color: #333; line-height: 1.3; }
  .marca { font-size: 5.5pt; letter-spacing: 0.08em; margin-top: 1.5mm; color: #666; }
</style>
</head>
<body>${etiqueta.repeat(Math.max(1, copias))}</body>
</html>`;
}

/** Impede que nome de cliente com < ou & quebre o HTML da etiqueta. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Abre o diálogo de impressão do Android. */
export async function imprimirEtiqueta(dados: DadosEtiqueta, copias = 1): Promise<void> {
  const svg = await svgDoQr(dados.conteudo);
  await Print.printAsync({ html: montarHtml(svg, dados, copias) });
}

/**
 * Gera o PDF e abre o menu de compartilhamento.
 *
 * É o caminho para impressora que não aparece no sistema: manda o arquivo
 * para o aplicativo dela, ou para o computador imprimir depois.
 */
export async function compartilharEtiqueta(dados: DadosEtiqueta, copias = 1): Promise<void> {
  const svg = await svgDoQr(dados.conteudo);
  await entregarPdf(montarHtml(svg, dados, copias), 'Etiqueta do equipamento');
}
