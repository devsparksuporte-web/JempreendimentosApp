import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import type { TechnicianStatus } from '@/types/database';

/**
 * Equipe em campo.
 *
 * O técnico reporta a própria posição; o administrador enxerga todo mundo no
 * mapa. A escrita passa por RPC `security definer` para que o vínculo com o
 * técnico logado seja garantido no servidor — ninguém reporta por outro.
 */

export type TecnicoEmCampo = {
  id: string;
  registration: string | null;
  status: TechnicianStatus;
  nome: string;
  /** Última posição conhecida. Null enquanto o técnico não reportar. */
  posicao: { latitude: number; longitude: number; atualizadoEm: string } | null;
  /** Chamado que ele está atendendo agora, se houver. */
  chamadoAtual: { id: string; code: number; title: string; cidade: string | null } | null;
};

export const STATUS_TECNICO: Record<TechnicianStatus, { rotulo: string; tom: 'success' | 'info' | 'warning' | 'neutral' }> = {
  disponivel: { rotulo: 'Disponível', tom: 'success' },
  a_caminho: { rotulo: 'A caminho', tom: 'info' },
  em_atendimento: { rotulo: 'Em campo', tom: 'info' },
  indisponivel: { rotulo: 'Em pausa', tom: 'warning' },
};

/** Considera "ao vivo" quem reportou nos últimos 15 minutos. */
export const JANELA_AO_VIVO_MS = 15 * 60 * 1000;

export function estaAoVivo(posicao: TecnicoEmCampo['posicao']): boolean {
  if (!posicao) return false;
  return Date.now() - new Date(posicao.atualizadoEm).getTime() < JANELA_AO_VIVO_MS;
}

export async function fetchEquipeEmCampo(): Promise<TecnicoEmCampo[]> {
  const { data, error } = await supabase
    .from('technicians')
    .select(
      `id, registration, status,
       profile:profile_id ( full_name ),
       localizacao:technician_locations ( latitude, longitude, updated_at )`,
    )
    .eq('active', true);

  if (error) throw new Error(error.message);

  const tecnicos = (data ?? []) as unknown as {
    id: string;
    registration: string | null;
    status: TechnicianStatus;
    profile: { full_name: string } | null;
    localizacao: { latitude: number; longitude: number; updated_at: string }[] | null;
  }[];

  // Chamados em andamento, para dizer o que cada um está fazendo.
  const { data: chamados } = await supabase
    .from('service_calls')
    .select('id, code, title, technician_id, address:address_id ( city )')
    .in('status', ['a_caminho', 'em_atendimento'])
    .not('technician_id', 'is', null);

  const porTecnico = new Map<string, TecnicoEmCampo['chamadoAtual']>();
  for (const c of (chamados ?? []) as unknown as {
    id: string;
    code: number;
    title: string;
    technician_id: string;
    address: { city: string } | null;
  }[]) {
    if (!porTecnico.has(c.technician_id)) {
      porTecnico.set(c.technician_id, {
        id: c.id,
        code: c.code,
        title: c.title,
        cidade: c.address?.city ?? null,
      });
    }
  }

  return tecnicos.map((t) => {
    const loc = Array.isArray(t.localizacao) ? t.localizacao[0] : t.localizacao;
    return {
      id: t.id,
      registration: t.registration,
      status: t.status,
      nome: t.profile?.full_name ?? 'Técnico sem nome',
      posicao: loc
        ? {
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            atualizadoEm: loc.updated_at,
          }
        : null,
      chamadoAtual: porTecnico.get(t.id) ?? null,
    };
  });
}

/**
 * Envia a posição atual do técnico. Chamado pelo app do técnico; falha em
 * silêncio para nunca atrapalhar o trabalho em campo.
 */
export async function reportarMinhaLocalizacao(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return false;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { error } = await supabase.rpc('report_technician_location', {
      p_latitude: pos.coords.latitude,
      p_longitude: pos.coords.longitude,
      p_accuracy: pos.coords.accuracy ?? null,
      p_heading: pos.coords.heading ?? null,
      p_speed: pos.coords.speed ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Iniciais para o marcador e o avatar da lista. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
