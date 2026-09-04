import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Faixa de indicadores do topo dos painéis.
 *
 * Um componente só para cliente, técnico e administração. Os números chegam
 * prontos de quem chama: aqui não se busca nada e não se sabe o que eles
 * significam — é o que evita virar um caso de "se for admin mostra outra
 * coisa" a cada indicador novo.
 *
 * O desenho é o do painel da administração, que já estava em uso: rótulo
 * pequeno em cima, número grande, linha de apoio embaixo e o ícone à direita.
 * Nessa ordem o olho encontra o número antes do enfeite.
 *
 * Quebra em coluna abaixo de 700px em vez de espremer quatro números lado a
 * lado num celular, onde nenhum deles ficaria legível.
 */

export type Indicador = {
  icone: LucideIcon;
  rotulo: string;
  valor: string | number;
  /** Linha de contexto sob o número: "2 urgente(s) na fila", "Sem horário". */
  apoio?: string;
  /** Cor do apoio quando ele informa estado — vermelho, verde, âmbar. */
  apoioCor?: string;
  /** Para valores que são texto, não contagem: nome de cliente, data. */
  valorPequeno?: boolean;
};

export function CartoesDeResumo({
  itens,
  emGrade,
}: {
  itens: Indicador[];
  /** Sobrepõe a decisão por largura quando quem chama já sabe o espaço útil. */
  emGrade?: boolean;
}) {
  const { width } = useWindowDimensions();
  const lado = emGrade ?? width >= 700;
  const celula: ViewStyle | undefined = lado ? styles.celula : undefined;

  return (
    <View style={[styles.faixa, lado && styles.faixaLinha]}>
      {itens.map(({ icone: Glifo, rotulo, valor, apoio, apoioCor, valorPequeno }) => (
        <Card key={rotulo} style={celula}>
          <View style={styles.linha}>
            <View style={styles.textos}>
              <Text variant="microLabel" color={colors.textSecondary}>
                {rotulo}
              </Text>
              <Text variant={valorPequeno ? 'cardTitle' : 'kpi'} numberOfLines={1}>
                {valor}
              </Text>
              {apoio ? (
                <Text variant="meta" color={apoioCor ?? colors.textMuted} numberOfLines={1}>
                  {apoio}
                </Text>
              ) : null}
            </View>
            <View style={styles.icone}>
              <Glifo size={26} color={colors.brand} />
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: { gap: spacing.md },
  faixaLinha: { flexDirection: 'row', flexWrap: 'wrap' },
  celula: { flexGrow: 1, flexBasis: 260 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  textos: { flex: 1, gap: 2 },
  icone: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
});
