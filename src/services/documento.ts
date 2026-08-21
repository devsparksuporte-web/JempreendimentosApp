import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Entrega um documento HTML para a pessoa guardar ou enviar.
 *
 * No aparelho, vira arquivo PDF e abre o menu de compartilhamento.
 *
 * No navegador não existe nem `printToFileAsync` nem `expo-sharing`. O
 * caminho equivalente ali é o próprio diálogo de impressão, onde "Salvar
 * como PDF" é uma das opções — chega no mesmo lugar sem inventar um
 * download que o navegador não sabe fazer.
 */
export async function entregarPdf(html: string, titulo: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return null;
  }

  const { uri } = await Print.printToFileAsync({ html });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartilhamento indisponível neste aparelho.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: titulo,
    UTI: 'com.adobe.pdf',
  });
  return uri;
}
