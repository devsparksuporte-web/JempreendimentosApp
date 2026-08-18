import { supabase } from '@/lib/supabase';

export type NotificationKind = 'info' | 'success' | 'warning' | 'danger';
export type AppNotification = { id: string; title: string; body: string | null; kind: NotificationKind; data: Record<string, unknown>; read_at: string | null; created_at: string };

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await (supabase as any).from('notifications').select('id, title, body, kind, data, read_at, created_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string) {
  const { error } = await (supabase as any).from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const { error } = await (supabase as any).from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) throw new Error(error.message);
}

export function subscribeToNotifications(profileId: string, onNotification: (notification: AppNotification) => void) {
  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profileId}` }, (payload) => {
      onNotification(payload.new as AppNotification);
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
