/**
 * Contrato entre a tela da equipe e o mapa.
 *
 * O mapa existe em duas versões — nativa e web — porque o `@rnmapbox/maps`
 * é módulo nativo sem entrada para navegador. Este arquivo guarda o que as
 * duas precisam receber, para que a tela não saiba em qual está rodando.
 *
 * Os pinos chegam prontos, com cor e avatar já resolvidos: assim a regra de
 * status mora num lugar só, na tela, e não duplicada nas duas versões.
 */
export type PinoDaEquipe = {
  id: string;
  nome: string;
  longitude: number;
  latitude: number;
  /** Cor do ponto de status, já decidida pela tela. */
  cor: string;
  avatar: string;
};

export type PropsDoMapa = {
  pinos: PinoDaEquipe[];
  /** Enquadra todos quando há mais de um. Nulo cai no `centro`. */
  limites: { ne: [number, number]; sw: [number, number] } | null;
  centro: [number, number];
  onSelecionar: (id: string) => void;
};
