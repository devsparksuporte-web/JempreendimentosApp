import { CalendarClock } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Escolha do dia e da hora da visita.
 *
 * Feito com cartelas em vez do seletor nativo de data de propósito. O
 * `@react-native-community/datetimepicker` obrigaria a recompilar o
 * aplicativo e não tem equivalente decente no navegador — e este projeto
 * roda nos dois. Cartelas funcionam igual nos dois lugares, e a operação é
 * de campo: ninguém agenda visita para daqui a oito meses, agenda para esta
 * semana ou a próxima.
 *
 * A janela é de três semanas e o expediente vai das 7h às 18h, de meia em
 * meia hora. Fora disso não é agendamento de visita, é exceção — e exceção
 * se combina por telefone.
 */

const DIAS_VISIVEIS = 21;
const HORA_INICIAL = 7;
const HORA_FINAL = 18;
const HORA_PADRAO = 8;

type Props = {
  valor: Date | null;
  onChange: (d: Date) => void;
};

export function SeletorDeVisita({ valor, onChange }: Props) {
  const dias = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from(
      { length: DIAS_VISIVEIS },
      (_, i) => new Date(base.getTime() + i * 86_400_000),
    );
  }, []);

  const horarios = useMemo(() => {
    const lista: { h: number; m: number }[] = [];
    for (let h = HORA_INICIAL; h <= HORA_FINAL; h += 1) {
      lista.push({ h, m: 0 });
      if (h < HORA_FINAL) lista.push({ h, m: 30 });
    }
    return lista;
  }, []);

  function escolherDia(dia: Date) {
    const d = new Date(dia);
    // Mantém a hora já escolhida; se ainda não houver, começa às 8h — que é
    // quando a equipe sai, não meia-noite.
    d.setHours(valor ? valor.getHours() : HORA_PADRAO, valor ? valor.getMinutes() : 0, 0, 0);
    onChange(d);
  }

  function escolherHora(h: number, m: number) {
    const d = valor ? new Date(valor) : new Date();
    if (!valor) d.setHours(0, 0, 0, 0);
    d.setHours(h, m, 0, 0);
    onChange(d);
  }

  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <View style={styles.raiz}>
      <View style={styles.resumo}>
        <CalendarClock size={17} color={colors.brand} />
        <Text variant="meta" color={valor ? colors.brandStrong : colors.textMuted}>
          {valor
            ? valor.toLocaleString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Nenhuma visita marcada'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
        {dias.map((dia) => {
          const ativo = !!valor && mesmoDia(dia, valor);
          return (
            <Pressable
              key={dia.toISOString()}
              onPress={() => escolherDia(dia)}
              accessibilityRole="button"
              style={[styles.dia, ativo && styles.ativo]}>
              <Text variant="microLabel" color={ativo ? colors.textOnBrand : colors.textMuted}>
                {dia
                  .toLocaleDateString('pt-BR', { weekday: 'short' })
                  .replace('.', '')
                  .slice(0, 3)
                  .toUpperCase()}
              </Text>
              <Text variant="bodyStrong" color={ativo ? colors.textOnBrand : colors.textPrimary}>
                {dia.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
        {horarios.map(({ h, m }) => {
          const ativo = !!valor && valor.getHours() === h && valor.getMinutes() === m;
          const rotulo = `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`;
          return (
            <Pressable
              key={rotulo}
              onPress={() => escolherHora(h, m)}
              accessibilityRole="button"
              style={[styles.hora, ativo && styles.ativo]}>
              <Text variant="meta" color={ativo ? colors.textOnBrand : colors.textSecondary}>
                {rotulo}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: spacing.sm },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fila: { gap: spacing.xs, paddingVertical: spacing.xs },
  dia: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  hora: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  ativo: { backgroundColor: colors.brand, borderColor: colors.brand },
});
