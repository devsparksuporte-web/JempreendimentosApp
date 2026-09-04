/**
 * O painel também atende por /inicio.
 *
 * A rota `index` do grupo resolve para a URL `/` — e no domínio publicado
 * `/` é o SITE institucional, não o sistema: o `pos-build-web` põe
 * `site/index.html` como `dist/index.html`. Enquanto o menu apontava para
 * lá, clicar em "Início" trocava a URL para `/`, e qualquer recarregamento,
 * link compartilhado ou volta do navegador caía no site.
 *
 * Aqui a mesma tela responde num endereço que é só do sistema. Não é uma
 * cópia: é o mesmo componente, exportado de novo.
 */
export { default } from './index';
