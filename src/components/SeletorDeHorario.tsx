import { ChevronLeft, ChevronRight, Lock } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { horariosDoTecnico, type FaixaDeHorario } from '@/services/agenda';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Grade de horários de um técnico num dia.
 *
 * Mostra o que existe e marca o que está tomado, em vez de deixar a pessoa
 * escolher e só então recusar. A recusa continua existindo no banco — é ela
 * que vale quando duas pessoas escolhem o mesmo horário no mesmo segundo —,
 * mas ninguém deveria descobrir que o horário está ocupado só depois de
 * preencher tudo e apertar salvar.
 *
 * Fora do expediente configurado a faixa nem aparece: horário que a empresa
 * não atende não é "indisponível", é inexistente.
 */

const DIA_MS = 86_400_000;

function inicioDoDia(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function rotuloDoDia(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).slice(0, 3).toUpperCase();
}

function hora(v: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}

export function SeletorDeHorario({
  technicianId,
  valor,
  aoEscolher,
  slotMinutos = 60,
  somenteLeitura = false,
}: {
  technicianId: string;
  /** Horário já escolhido, para manter a marcação ao voltar à tela. */
  valor: Date | null;
  aoEscolher?: (inicio: Date) => void;
  slotMinutos?: number;
  /** Modo painel: mostra a agenda do dia sem permitir escolher. */
  somenteLeitura?: boolean;
}) {
  const [dia, setDia] = useState(() => inicioDoDia(valor ?? new Date()));
  // O resultado carrega junto a pergunta que o gerou. Assim "carregando" e
  // "deu erro" são comparações, e não estados paralelos que precisariam ser
  // zerados dentro do efeito a cada troca de dia — que é justamente o que
  // dispara renderizações em cascata.
  const [achado, setAchado] = useState<{ chave: string; faixas: FaixaDeHorario[] }>({
    chave: '',
    faixas: [],
  });
  const [falha, setFalha] = useState<{ chave: string; msg: string } | null>(null);

  const chave = `${technicianId}|${dia.toDateString()}|${slotMinutos}`;
  const faixas = achado.chave === chave ? achado.faixas : [];
  const erro = falha?.chave === chave ? falha.msg : null;
  const carregando = achado.chave !== chave && !erro;

  const semana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(inicioDoDia(dia).getTime() + (i - 3) * DIA_MS)),
    [dia],
  );

  useEffect(() => {
    let valeu = true;
    void (async () => {
      try {
        const r = await horariosDoTecnico(technicianId, dia, slotMinutos);
        if (valeu) setAchado({ chave, faixas: r });
      } catch (e) {
        if (valeu) {
          setFalha({ chave, msg: e instanceof Error ? e.message : 'Não foi possível carregar a agenda.' });
        }
      }
    })();
    // Trocar de dia depressa não pode deixar a resposta antiga chegar por
    // último e sobrescrever a nova.
    return () => {
      valeu = false;
    };
  }, [technicianId, dia, slotMinutos, chave]);

  const escolhido = valor?.toISOString() ?? null;

  return (
    <View style={styles.raiz}>
      <View style={styles.semana}>
        <Pressable
          onPress={() => setDia(new Date(dia.getTime() - 7 * DIA_MS))}
          accessibilityLabel="Semana anterior"
          style={styles.seta}>
          <ChevronLeft size={18} color={colors.textMuted} />
        </Pressable>
        {semana.map((d) => {
          const ativo = d.toDateString() === dia.toDateString();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => setDia(d)}
              style={[styles.dia, ativo && styles.diaAtivo]}>
              <Text variant="microLabel" color={ativo ? colors.textOnBrand : colors.textMuted}>
                {rotuloDoDia(d)}
              </Text>
              <Text variant="bodyStrong" color={ativo ? colors.textOnBrand : colors.textPrimary}>
                {d.getDate()}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setDia(new Date(dia.getTime() + 7 * DIA_MS))}
          accessibilityLabel="Próxima semana"
          style={styles.seta}>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {carregando ? (
        <View style={styles.aviso}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text variant="meta" color={colors.textMuted}>
            Carregando a agenda do dia…
          </Text>
        </View>
      ) : erro ? (
        <View style={styles.aviso}>
          <Text variant="meta" color={colors.dangerStrong}>
            {erro}
          </Text>
        </View>
      ) : faixas.length === 0 ? (
        <View style={styles.aviso}>
          <Text variant="meta" color={colors.textSecondary}>
            Sem expediente neste dia.
          </Text>
        </View>
      ) : (
        <View style={styles.grade}>
          {faixas.map((f) => {
            const marcado = escolhido === f.inicio;
            const bloqueado = f.ocupado && !marcado;
            return (
              <Pressable
                key={f.inicio}
                disabled={somenteLeitura || bloqueado}
                onPress={() => aoEscolher?.(new Date(f.inicio))}
                accessibilityState={{ disabled: bloqueado, selected: marcado }}
                style={({ pressed }) => [
                  styles.faixa,
                  bloqueado && styles.faixaOcupada,
                  marcado && styles.faixaMarcada,
                  pressed && !bloqueado && styles.tocada,
                ]}>
                <View style={styles.faixaTopo}>
                  <Text
                    variant="bodyStrong"
                    color={
                      marcado ? colors.textOnBrand : bloqueado ? colors.textMuted : colors.textPrimary
                    }>
                    {hora(f.inicio)}
                  </Text>
                  {bloqueado ? <Lock size={13} color={colors.textMuted} /> : null}
                </View>
                <Text
                  variant="meta"
                  numberOfLines={1}
                  color={marcado ? colors.textOnBrand : bloqueado ? colors.textMuted : colors.textSecondary}>
                  {f.ocupado
                    ? f.code
                      ? `#${f.code}${f.cliente ? ` · ${f.cliente}` : ''}`
                      : 'Ocupado'
                    : 'Disponível'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: spacing.md },

  semana: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seta: { width: 28, height: 46, alignItems: 'center', justifyContent: 'center' },
  dia: {
    width: 42,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    gap: 2,
  },
  diaAtivo: { backgroundColor: colors.brand },

  aviso: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  faixa: {
    flexGrow: 1,
    flexBasis: 128,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  faixaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faixaOcupada: { backgroundColor: colors.bgApp, borderColor: colors.border },
  faixaMarcada: { backgroundColor: colors.brand, borderColor: colors.brand },
  tocada: { opacity: 0.85 },
});
