import { supabase } from '@/lib/supabase';

export type NotificationKind = 'info' | 'success' | 'warning' | 'danger';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Categorias usadas nos filtros da central e nas preferências. */
export type NotificationCategory =
  | 'chamados'
  | 'estoque'
  | 'servicos'
  | 'mensagens'
  | 'financeiro'
  | 'agenda'
  | 'equipe'
  | 'geral';

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  kind: NotificationKind;
  /** Evento de origem: NEW_TICKET, STOCK_LOW, … */
  tipo: string | null;
  categoria: NotificationCategory | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: NotificationPriority;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const CAMPOS =
  'id, title, body, kind, tipo, categoria, entity_type, entity_id, priority, data, metadata, read_at, created_at';

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await (supabase as any)
    .from('notifications')
    .select(CAMPOS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function contarNaoLidas(): Promise<number> {
  const { count, error } = await (supabase as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const { error } = await (supabase as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

export function subscribeToNotifications(
  profileId: string,
  onNotification: (notification: AppNotification) => void,
) {
  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${profileId}`,
      },
      (payload) => {
        onNotification(payload.new as AppNotification);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Para onde a notificação leva.
 *
 * `entity_type`/`entity_id` são o caminho novo; `data.call_id` fica como
 * reserva para o que foi gravado antes desses campos existirem.
 */
export function destinoDaNotificacao(n: AppNotification): string | null {
  if (n.entity_type === 'chamado' && n.entity_id) return `/chamado/${n.entity_id}`;
  if (n.entity_type === 'estoque') return '/(admin)/estoque';
  const antigo = typeof n.data?.call_id === 'string' ? n.data.call_id : null;
  return antigo ? `/chamado/${antigo}` : null;
}

// ---------------------------------------------------------------------------
// Preferências por categoria
// ---------------------------------------------------------------------------

export type PreferenciaNotificacao = { categoria: string; habilitado: boolean };

/** Categorias que o usuário pode desligar. Críticas do fluxo ficam de fora. */
export const CATEGORIAS_CONFIGURAVEIS: { chave: NotificationCategory; rotulo: string }[] = [
  { chave: 'chamados', rotulo: 'Chamados' },
  { chave: 'mensagens', rotulo: 'Mensagens' },
  { chave: 'estoque', rotulo: 'Estoque' },
  { chave: 'agenda', rotulo: 'Agendamentos' },
  { chave: 'financeiro', rotulo: 'Financeiro' },
  { chave: 'servicos', rotulo: 'Serviços' },
  { chave: 'equipe', rotulo: 'Equipe' },
];

export async function fetchPreferencias(): Promise<Record<string, boolean>> {
  const { data, error } = await (supabase as any)
    .from('notification_preferences')
    .select('categoria, habilitado');
  if (error) throw new Error(error.message);

  // Ausência de linha significa ligado: o padrão é receber.
  const mapa: Record<string, boolean> = {};
  for (const c of CATEGORIAS_CONFIGURAVEIS) mapa[c.chave] = true;
  for (const p of (data ?? []) as PreferenciaNotificacao[]) mapa[p.categoria] = p.habilitado;
  return mapa;
}

export async function definirPreferencia(categoria: string, habilitado: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  const perfil = auth.user?.id;
  if (!perfil) throw new Error('Sessão expirada.');

  const { error } = await (supabase as any)
    .from('notification_preferences')
    .upsert({ profile_id: perfil, categoria, habilitado }, { onConflict: 'profile_id,categoria' });
  if (error) throw new Error(error.message);
}
