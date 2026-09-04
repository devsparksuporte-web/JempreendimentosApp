import { supabase } from '@/lib/supabase';

/**
 * Busca global do sistema.
 *
 * Uma consulta por tabela, em paralelo, com teto baixo de linhas. O objetivo
 * é achar o que a pessoa já sabe que existe — um chamado, um cliente, um
 * aparelho — e não navegar pelo catálogo: para isso existem as telas de
 * lista, com filtro e paginação.
 *
 * Quem enxerga o quê é a RLS que decide. O cliente que buscar "capacitor"
 * não recebe nada do estoque, e o técnico só encontra os chamados dele —
 * sem nenhum filtro por papel aqui. Repetir a regra no aplicativo criaria um
 * segundo lugar para ela divergir.
 *
 * Erro de uma tabela não derruba o resultado das outras: uma busca que
 * devolve metade é mais útil que uma tela vermelha.
 */

export type TipoDeResultado = 'chamado' | 'cliente' | 'equipamento' | 'peca';

export type Resultado = {
  tipo: TipoDeResultado;
  id: string;
  titulo: string;
  apoio: string;
  destino: string;
};

export const ROTULO_TIPO: Record<TipoDeResultado, string> = {
  chamado: 'Chamados',
  cliente: 'Clientes',
  equipamento: 'Equipamentos',
  peca: 'Estoque',
};

/** Abaixo disso a busca não sai: duas letras trazem meio banco. */
export const MINIMO_PARA_BUSCAR = 3;

const POR_TIPO = 5;

/** Escapa o que o PostgREST trata como separador dentro de `or(...)`. */
function limpar(termo: string): string {
  return termo.replace(/[(),*]/g, ' ').trim();
}

async function semQuebrar<T>(promessa: PromiseLike<{ data: T[] | null; error: unknown }>) {
  try {
    const { data, error } = await promessa;
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

export async function buscarGlobal(termo: string): Promise<Resultado[]> {
  const t = limpar(termo);
  if (t.length < MINIMO_PARA_BUSCAR) return [];
  const like = `%${t}%`;
  const q = supabase as any;

  // O código do chamado é número: só entra na busca quando o termo é numérico,
  // senão o PostgREST recusa a comparação e a consulta inteira falha.
  const numero = /^\d+$/.test(t) ? t : null;
  const filtroChamado = numero
    ? `title.ilike.${like},code.eq.${numero}`
    : `title.ilike.${like}`;

  const [chamados, clientes, equipamentos, pecas] = await Promise.all([
    semQuebrar<any>(
      q.from('service_calls')
        .select('id, code, title, status, client:client_id ( name )')
        .or(filtroChamado)
        .order('created_at', { ascending: false })
        .limit(POR_TIPO),
    ),
    semQuebrar<any>(
      q.from('clients').select('id, name, doc').ilike('name', like).limit(POR_TIPO),
    ),
    semQuebrar<any>(
      q.from('equipment')
        .select('id, brand, model, environment, serial_number')
        .or(`brand.ilike.${like},model.ilike.${like},serial_number.ilike.${like}`)
        .limit(POR_TIPO),
    ),
    semQuebrar<any>(
      q.from('parts')
        .select('id, name, sku, quantity:inventory(quantity)')
        .or(`name.ilike.${like},sku.ilike.${like}`)
        .limit(POR_TIPO),
    ),
  ]);

  return [
    ...chamados.map((c: any) => ({
      tipo: 'chamado' as const,
      id: c.id,
      titulo: `#${c.code} · ${c.title}`,
      apoio: [c.client?.name, String(c.status ?? '').replaceAll('_', ' ')].filter(Boolean).join(' · '),
      destino: `/chamado/${c.id}`,
    })),
    ...clientes.map((c: any) => ({
      tipo: 'cliente' as const,
      id: c.id,
      titulo: c.name,
      apoio: c.doc ?? 'Sem documento',
      destino: `/(admin)/cliente/${c.id}`,
    })),
    ...equipamentos.map((e: any) => ({
      tipo: 'equipamento' as const,
      id: e.id,
      titulo: [e.brand, e.model].filter(Boolean).join(' ') || 'Equipamento',
      apoio: [e.environment, e.serial_number].filter(Boolean).join(' · ') || 'Sem ambiente',
      destino: `/(admin)/equipamento/${e.id}`,
    })),
    ...pecas.map((p: any) => ({
      tipo: 'peca' as const,
      id: p.id,
      titulo: p.name,
      apoio: p.sku ? `SKU ${p.sku}` : 'Sem SKU',
      destino: `/(admin)/produto/${p.id}`,
    })),
  ];
}

/** Agrupa por tipo mantendo a ordem em que os grupos devem aparecer. */
export function agruparResultados(itens: Resultado[]) {
  const ordem: TipoDeResultado[] = ['chamado', 'cliente', 'equipamento', 'peca'];
  return ordem
    .map((tipo) => ({ tipo, itens: itens.filter((i) => i.tipo === tipo) }))
    .filter((g) => g.itens.length > 0);
}
