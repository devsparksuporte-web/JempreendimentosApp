import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { ArrowLeft, QrCode } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';

export default function TechnicianQrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('Aponte a câmera para a etiqueta do equipamento.');

  async function handleCode({ data }: { data: string }) {
    if (locked) return;
    setLocked(true);
    setMessage('Localizando equipamento…');
    const { data: qr, error } = await (supabase as any).from('equipment_qr_codes').select('equipment_id').eq('code', data.trim()).eq('active', true).limit(1).maybeSingle();
    if (error || !qr) {
      setMessage(error?.message ?? 'QR Code não encontrado ou inativo.');
      setLocked(false);
      return;
    }
    router.replace(`/(tecnico)/equipamento/${qr.equipment_id}`);
  }

  if (!permission) return <View style={styles.center}><Text variant="body">Verificando câmera…</Text></View>;
  if (!permission.granted) return <View style={styles.center}><QrCode size={42} color={colors.brand} /><Text variant="screenTitle">Permissão de câmera</Text><Text variant="body" color={colors.textSecondary}>A câmera é necessária para iniciar o atendimento pelo QR Code.</Text><Pressable onPress={requestPermission} style={styles.button}><Text variant="bodyStrong" color={colors.textOnBrand}>Permitir câmera</Text></Pressable></View>;

  return <View style={styles.root}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={locked ? undefined : handleCode}><View style={styles.overlay}><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={22} color={colors.textPrimary} /></Pressable><View style={styles.frame} /><View style={styles.caption}><Text variant="bodyStrong" color={colors.textPrimary}>{message}</Text></View></View></CameraView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#061526' },
  camera: { flex: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  back: { position: 'absolute', top: 56, left: spacing.lg, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: colors.brand, borderRadius: radius.xl },
  caption: { marginTop: spacing.xl, maxWidth: 300, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  center: { flex: 1, backgroundColor: colors.bgApp, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  button: { backgroundColor: colors.brand, borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
});
