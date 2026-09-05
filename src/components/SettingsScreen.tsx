import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CalendarClock,
  ClipboardList,
  HardHat,
  PackageSearch,
  Wallet, Bell, ChevronLeft, ChevronRight, Clock3, Edit3, FileText, History, LockKeyhole, LogOut, Mail, MapPin, MessageSquare, Phone, RefreshCw, Settings, ShieldCheck, UserRound, Wifi } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useAuth } from '@/context/AuthContext';
import { Alert } from '@/lib/alerta';
import {
  CATEGORIAS_CONFIGURAVEIS,
  definirPreferencia,
  fetchPreferencias,
} from '@/services/notifications';
import { AvisoDeBateria } from '@/components/AvisoDeBateria';
import { FotoDePerfil } from '@/components/FotoDePerfil';
import { telefoneBonito } from '@/services/perfil';
import { colors, fonts, layout, radius, spacing, touch } from '@/theme/tokens';

type SettingsScreenProps = { roleLabel: string; subtitle: string };
/** O que continua sendo preferência deste aparelho, e não da conta. */
type Preferences = { shareLocation: boolean; serviceHistory: boolean; technicalDetails: boolean };
const DEFAULT_PREFERENCES: Preferences = { shareLocation: true, serviceHistory: true, technicalDetails: false };

/** Um ícone por categoria; o Bell fica de reserva para categoria nova. */
const ICONE_CATEGORIA: Record<string, typeof Bell> = {
  chamados: ClipboardList,
  mensagens: MessageSquare,
  estoque: PackageSearch,
  agenda: CalendarClock,
  financeiro: Wallet,
  servicos: RefreshCw,
  equipe: HardHat,
};

export function SettingsScreen({ roleLabel, subtitle }: SettingsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, signOut } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);

  /**
   * Preferências de notificação por categoria.
   *
   * Ficam no banco, e não neste aparelho: quem desliga "Estoque" no
   * tablet não quer receber estoque no celular também. Ausência de linha
   * significa ligado — o padrão é receber.
   */
  const [avisos, setAvisos] = useState<Record<string, boolean>>({});
  const [avisosProntos, setAvisosProntos] = useState(false);

  useEffect(() => {
    fetchPreferencias()
      .then(setAvisos)
      .catch(() => undefined)
      .finally(() => setAvisosProntos(true));
  }, []);

  /** Aplica na hora e desfaz se o banco recusar — o interruptor não pode mentir. */
  async function alternarAviso(categoria: string) {
    const desejado = !(avisos[categoria] ?? true);
    setAvisos((a) => ({ ...a, [categoria]: desejado }));
    setSaving(true);
    try {
      await definirPreferencia(categoria, desejado);
    } catch (e) {
      setAvisos((a) => ({ ...a, [categoria]: !desejado }));
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { AsyncStorage.getItem('jempreendimentos.settings.preferences').then((raw) => { if (raw) setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) as Partial<Preferences> }); }).catch(() => undefined); }, []);

  async function toggle(key: keyof Preferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next); setSaving(true);
    try { await AsyncStorage.setItem('jempreendimentos.settings.preferences', JSON.stringify(next)); } finally { setSaving(false); }
  }

  function confirmSignOut() { Alert.alert('Sair do sistema', 'Deseja encerrar esta sessão?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: () => { void signOut().then(() => { router.replace('/(auth)/login'); }).catch((err) => { Alert.alert('Não foi possível sair', err instanceof Error ? err.message : 'Tente novamente.'); }); } }]); }
  function unavailable(label: string) { Alert.alert(label, 'Esta opção será aberta no próximo módulo de configurações.'); }

  return <View style={styles.root}><View style={[styles.topHeader, { paddingTop: insets.top + spacing.md }]}><View style={styles.topHeaderInner}><Pressable onPress={() => router.back()} style={styles.backButton}><ChevronLeft size={23} color={colors.textPrimary} /></Pressable><Text variant="screenTitle" color={colors.brandStrong}>Configurações</Text><Settings size={22} color={colors.brand} /></View></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}><View style={styles.container}><Text variant="body" color={colors.textSecondary}>{subtitle}</Text><FotoDePerfil /><SectionLabel text="Perfil profissional" /><View style={styles.group}><ProfileRow icon={UserRound} label="Nome" value={profile?.full_name || 'Toque para informar'} onPress={() => router.push('/editar-perfil' as never)} /><ProfileRow icon={Phone} label="Telefone" value={telefoneBonito(profile?.phone) || 'Toque para informar'} onPress={() => router.push('/editar-perfil' as never)} /><ProfileRow icon={Mail} label="Email" value={session?.user.email ?? 'Sessão autenticada'} onPress={() => Alert.alert('Email de acesso', 'O email é o seu login e não muda por aqui. Para trocá-lo, fale com a administração.')} /></View><SectionLabel text="Notificações" /><View style={styles.group}>{!avisosProntos ? <View style={styles.toggleRow}><Text variant="meta" color={colors.textMuted}>Carregando preferências…</Text></View> : CATEGORIAS_CONFIGURAVEIS.map((c) => <ToggleRow key={c.chave} icon={ICONE_CATEGORIA[c.chave] ?? Bell} label={c.rotulo} value={avisos[c.chave] ?? true} onValueChange={() => { void alternarAviso(c.chave); }} />)}</View><Text variant="meta" color={colors.textMuted} style={styles.notaAvisos}>Avisos críticos do fluxo continuam chegando mesmo desligados — é o caso de um chamado urgente sem técnico.</Text><AvisoDeBateria /><SectionLabel text="Privacidade" /><View style={styles.group}><ToggleRow icon={MapPin} label="Compartilhar localização" value={preferences.shareLocation} onValueChange={() => { void toggle('shareLocation'); }} accent={colors.warning} /><ToggleRow icon={History} label="Histórico de serviços" value={preferences.serviceHistory} onValueChange={() => { void toggle('serviceHistory'); }} /><ToggleRow icon={FileText} label="Dados técnicos detalhados" value={preferences.technicalDetails} onValueChange={() => { void toggle('technicalDetails'); }} /></View><SectionLabel text="Conta e suporte" /><View style={styles.group}><ActionRow icon={ShieldCheck} label="Trocar senha" description="Exige a senha atual antes de alterar" onPress={() => router.push('/trocar-senha' as never)} /><ActionRow icon={Wifi} label="Modo de campo" description="Preferências salvas neste dispositivo" onPress={() => unavailable('Modo de campo')} /><ActionRow icon={MessageSquare} label="Falar com suporte" description="Abra seu aplicativo de email" onPress={() => { void Linking.openURL('mailto:suporte@jempreendimentos.com.br'); }} /></View><Pressable onPress={confirmSignOut} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}><LogOut size={19} color={colors.dangerStrong} /><Text variant="bodyStrong" color={colors.dangerStrong}>Sair da conta</Text></Pressable><Text variant="meta" color={colors.textMuted} style={styles.version}>{saving ? 'Salvando preferências...' : `JEmpreendimentos · ${roleLabel} · v1.0.0`}</Text></View></ScrollView></View>;
}

function SectionLabel({ text }: { text: string }) { return <Text variant="microLabel" color={colors.textMuted} style={styles.sectionLabel}>{text}</Text>; }
function ProfileRow({ icon: Icon, label, value, onPress }: { icon: typeof UserRound; label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}><View style={styles.rowIcon}><Icon size={19} color={colors.brand} /></View><View style={styles.rowText}><Text variant="microLabel" color={colors.textMuted}>{label}</Text><Text variant="bodyStrong" numberOfLines={1}>{value}</Text></View><Edit3 size={17} color={colors.slate300} /></Pressable>; }
function ToggleRow({ icon: Icon, label, value, onValueChange, accent = colors.brand }: { icon: typeof Bell; label: string; value: boolean; onValueChange: () => void; accent?: string }) { return <View style={styles.toggleRow}><View style={[styles.toggleIcon, { backgroundColor: `${accent}15` }]}><Icon size={19} color={accent} /></View><Text variant="bodyStrong" style={styles.toggleLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.slate200, true: colors.success }} thumbColor={colors.bgSurface} ios_backgroundColor={colors.slate200} /></View>; }
function ActionRow({ icon: Icon, label, description, onPress }: { icon: typeof ShieldCheck; label: string; description: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}><View style={styles.rowIcon}><Icon size={19} color={colors.brand} /></View><View style={styles.rowText}><Text variant="bodyStrong">{label}</Text><Text variant="meta" color={colors.textSecondary}>{description}</Text></View><ChevronRight size={18} color={colors.slate300} /></Pressable>; }

const styles = StyleSheet.create({
root: { flex: 1, backgroundColor: colors.bgApp }, topHeader: { backgroundColor: colors.bgSurface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.lg }, topHeaderInner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.screenPadding, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, backButton: { width: touch.minTarget - 8, height: touch.minTarget - 8, borderRadius: radius.pill, backgroundColor: colors.slate50, alignItems: 'center', justifyContent: 'center' }, scroll: { flexGrow: 1, alignItems: 'center' }, container: { width: '100%', maxWidth: layout.maxContentWidth, paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, gap: spacing.md }, sectionLabel: { marginTop: spacing.md, marginLeft: spacing.xs, letterSpacing: 1.8 }, group: { backgroundColor: colors.bgSurface, borderRadius: 28, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', shadowColor: colors.brandStrong, shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, profileRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate50 }, rowIcon: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }, rowText: { flex: 1, gap: 3 }, toggleRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate50 }, toggleIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, toggleLabel: { flex: 1 }, actionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate50 }, logout: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft, borderRadius: radius.xl, marginTop: spacing.md }, notaAvisos: { paddingHorizontal: spacing.xs, marginTop: spacing.xs }, version: { textAlign: 'center', paddingVertical: spacing.sm }, pressed: { opacity: 0.72 }, });
