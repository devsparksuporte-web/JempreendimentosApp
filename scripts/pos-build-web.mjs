import { copyFile, rename, access, cp } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Põe o site da empresa na frente do sistema, no mesmo domínio.
 *
 * A Vercel resolve arquivo do disco ANTES de aplicar rewrite. Enquanto o
 * `dist/index.html` for o app, `/` sempre abre o app e nenhuma regra de
 * rewrite chega a ser consultada. Por isso a troca é física:
 *
 *   dist/index.html  (app)   ->  dist/app.html
 *   site/index.html  (site)  ->  dist/index.html
 *
 * Com isso `/` acha o site no disco e é servido direto, e todo o resto
 * (/login, /estoque, /cliente/123...) não acha arquivo nenhum e cai no
 * rewrite do vercel.json, que entrega o app. A rota `/` do Expo Router
 * fica inalcançável, o que não custa nada: ela só redirecionava para o
 * login ou para o painel do perfil.
 *
 * Roda depois do `expo export`. Ver `buildCommand` no vercel.json.
 */

const raiz = process.cwd();
const dist = join(raiz, 'dist');

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

const appHtml = join(dist, 'app.html');
const indexHtml = join(dist, 'index.html');
const siteHtml = join(raiz, 'site', 'index.html');

if (!(await existe(indexHtml))) {
  throw new Error('dist/index.html não existe. O `expo export -p web` rodou?');
}
if (!(await existe(siteHtml))) {
  throw new Error('site/index.html não existe.');
}

// Sem esta guarda, rodar duas vezes seguidas sobrescreveria o app.html
// com o site — e aí o sistema inteiro viraria a página de vendas.
if (await existe(appHtml)) {
  throw new Error('dist/app.html já existe. Apague dist/ e exporte de novo.');
}

await rename(indexHtml, appHtml);
await copyFile(siteHtml, indexHtml);

// As fotos do site vão junto. Sem isto o site sobe com todas as imagens
// quebradas: o `expo export` só conhece os assets do aplicativo, e a pasta
// `site/fotos` nunca chega ao `dist`.
const fotosOrigem = join(raiz, 'site', 'fotos');
if (await existe(fotosOrigem)) {
  await cp(fotosOrigem, join(dist, 'fotos'), { recursive: true });
  console.log('fotos do site copiadas para dist/fotos');
}

console.log('site em /  ·  app em /app.html (servido por rewrite)');
