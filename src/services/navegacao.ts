/**
 * Navegação dentro do app.
 *
 * Usa a Directions API do Mapbox para traçar o trajeto que segue as ruas —
 * diferente de ligar os pontos com uma reta, que ignora o caminho real. As
 * instruções voltam em português e alimentam a lista de manobras na tela.
 *
 * O token público basta para isso; nada aqui exige credencial secreta.
 */

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export type Coordenada = [number, number]; // [longitude, latitude]

export type Manobra = {
  instrucao: string;
  distancia: number; // metros até a próxima manobra
  nome: string; // nome da via
};

export type Trajeto = {
  /** Linha que segue as ruas, pronta para o ShapeSource do mapa. */
  coordenadas: Coordenada[];
  distancia: number; // metros
  duracao: number; // segundos
  manobras: Manobra[];
};

/**
 * Decodifica a polyline do Mapbox (precisão 5).
 *
 * O formato empacota cada coordenada como delta em base64 de 5 bits; sem
 * decodificar, a geometria não vira linha no mapa.
 */
export function decodificarPolyline(texto: string, precisao = 5): Coordenada[] {
  const fator = Math.pow(10, precisao);
  const coordenadas: Coordenada[] = [];
  let indice = 0;
  let lat = 0;
  let lng = 0;

  while (indice < texto.length) {
    let resultado = 0;
    let deslocamento = 0;
    let byte: number;

    do {
      byte = texto.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (byte >= 0x20);
    lat += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    resultado = 0;
    deslocamento = 0;
    do {
      byte = texto.charCodeAt(indice++) - 63;
      resultado |= (byte & 0x1f) << deslocamento;
      deslocamento += 5;
    } while (byte >= 0x20);
    lng += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    coordenadas.push([lng / fator, lat / fator]);
  }

  return coordenadas;
}

/** Busca o trajeto de carro passando por todos os pontos, na ordem dada. */
export async function buscarTrajeto(pontos: Coordenada[]): Promise<Trajeto | null> {
  if (!TOKEN || pontos.length < 2) return null;

  // A API aceita no máximo 25 pontos por requisição.
  const caminho = pontos
    .slice(0, 25)
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';');

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${caminho}` +
    `?geometries=polyline&overview=full&steps=true&language=pt-BR&access_token=${TOKEN}`;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as {
      code?: string;
      routes?: {
        geometry: string;
        distance: number;
        duration: number;
        legs: {
          steps: { maneuver: { instruction: string }; distance: number; name: string }[];
        }[];
      }[];
    };

    if (dados.code !== 'Ok' || !dados.routes?.length) return null;
    const rota = dados.routes[0];

    return {
      coordenadas: decodificarPolyline(rota.geometry),
      distancia: rota.distance,
      duracao: rota.duration,
      manobras: rota.legs.flatMap((leg) =>
        leg.steps.map((s) => ({
          instrucao: s.maneuver.instruction,
          distancia: s.distance,
          nome: s.name,
        })),
      ),
    };
  } catch {
    return null;
  }
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatarDuracao(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`;
}
