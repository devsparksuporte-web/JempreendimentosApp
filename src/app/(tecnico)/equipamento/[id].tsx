import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/ui/States';
import { findTechnicianCallByEquipment } from '@/services/technician';

export default function TechnicianEquipmentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    findTechnicianCallByEquipment(id).then((call) => router.replace(`/(tecnico)/chamado/${call.id}`)).catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível abrir o atendimento.'));
  }, [id, router]);

  if (error) return <ErrorState message={error} onRetry={() => { setError(null); if (id) findTechnicianCallByEquipment(id).then((call) => router.replace(`/(tecnico)/chamado/${call.id}`)).catch((err) => setError(err instanceof Error ? err.message : 'Erro ao abrir atendimento.')); }} />;
  return <View style={{ flex: 1 }}><LoadingState /></View>;
}
