import { Platform } from 'react-native';

import type { PropsDoMapa } from './MapaDaEquipe.tipos';

/**
 * Escolhe a versão do mapa conforme a plataforma.
 *
 * Mesmo padrão do MapboxRouteMap: o Metro resolveria `.native` e `.web`
 * sozinho pelo nome do arquivo, mas o TypeScript não — sem este arquivo ele
 * não acha o módulo `@/components/MapaDaEquipe`.
 *
 * O `require` é condicional de propósito. Um `import` estático do lado
 * nativo entraria no bundle web e traria de volta exatamente o problema que
 * esta separação existe para resolver: `@rnmapbox/maps` não tem entrada
 * para navegador e derruba a tela em branco.
 */
export const MapaDaEquipe: (props: PropsDoMapa) => React.ReactElement =
  Platform.OS === 'web'
    ? require('./MapaDaEquipe.web').MapaDaEquipe
    : require('./MapaDaEquipe.native').MapaDaEquipe;
