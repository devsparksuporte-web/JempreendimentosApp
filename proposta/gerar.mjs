import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

/**
 * Gera o PDF da proposta a partir do HTML.
 *
 * Usa o Chrome (ou o Edge) que já está instalado, em modo headless. Não
 * baixa navegador nenhum: um Chromium só para imprimir uma página seriam
 * 150 MB para fazer o que a máquina já sabe fazer.
 *
 * O `--print-to-pdf` respeita a regra `@page` do CSS, então o formato A4 e
 * as margens saem do próprio documento.
 */

const rodar = promisify(execFile);
const aqui = dirname(fileURLToPath(import.meta.url));

const CANDIDATOS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

async function acharNavegador() {
  for (const c of CANDIDATOS) {
    try {
      await access(c);
      return c;
    } catch {}
  }
  throw new Error('Nenhum Chrome ou Edge encontrado nos caminhos conhecidos.');
}

// Aceita o nome do documento por argumento: `node proposta/gerar.mjs manual`
const nome = process.argv[2] ?? 'proposta';
const SAIDAS = {
  proposta: 'Proposta-JEmpreendimentos.pdf',
  manual: 'Manual-JEmpreendimentos.pdf',
  'google-ads': 'Proposta-GoogleAds-JEmpreendimentos.pdf',
};
const entrada = resolve(aqui, `${nome}.html`);
const saida = resolve(aqui, SAIDAS[nome] ?? `${nome}.pdf`);
const navegador = await acharNavegador();

await rodar(navegador, [
  '--headless=new',
  '--disable-gpu',
  // Sem cabeçalho e rodapé do navegador: a página já traz os seus.
  '--no-pdf-header-footer',
  `--print-to-pdf=${saida}`,
  // O atraso dá tempo de a fonte do Google carregar antes da impressão.
  '--virtual-time-budget=8000',
  pathToFileURL(entrada).href,
]);

console.log('PDF gerado em', saida);
