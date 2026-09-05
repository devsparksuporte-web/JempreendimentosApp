import {
  Headphones,
  Snowflake,
  ThermometerSun,
  Wrench,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Painel de apresentação ao lado do formulário de login, na web.
 *
 * Só aparece em tela larga. No celular ele não existe: quem abre o
 * aplicativo já escolheu entrar, e quatro blocos de texto entre a pessoa e
 * o campo de email são quatro rolagens até o que ela veio fazer.
 *
 * A foto fica sob uma camada escura em degradê. Sem ela o texto branco
 * some nas partes claras da imagem, e o contraste passa a depender de qual
 * foto está no lugar — o tipo de coisa que quebra quando alguém troca o
 * arquivo meses depois.
 */

type Destaque = { icone: LucideIcon; titulo: string; texto: string };

const DESTAQUES: Destaque[] = [
  {
    icone: Wrench,
    titulo: 'Manutenção Preventiva e Corretiva',
    texto: 'Garantimos o funcionamento perfeito dos seus equipamentos.',
  },
  {
    icone: Snowflake,
    titulo: 'Instalação Especializada',
    texto: 'Instalação de sistemas com segurança, eficiência e qualidade.',
  },
  {
    icone: ThermometerSun,
    titulo: 'PMOC e Qualidade do Ar',
    texto: 'Planos de manutenção conforme normas e foco na saúde e bem-estar.',
  },
  {
    icone: Headphones,
    titulo: 'Suporte Técnico Ágil',
    texto: 'Atendimento rápido e humanizado sempre que você precisar.',
  },
];

export function PainelDaMarca() {
  return (
    <View style={styles.painel}>
      <Image
        source={require('@/assets/images/login-tecnico.jpg')}
        style={styles.foto}
        resizeMode="cover"
      />
      <View style={styles.veu} />

      <View style={styles.conteudo}>
        <View style={styles.marca}>
          <Image
            source={require('@/assets/images/logo-j.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <Text variant="cardTitle" color={colors.textOnBrand}>
              JEmpreendimentos
            </Text>
            <Text variant="body" color={colors.slate300}>
              Gestão Inteligente de Serviços
            </Text>
          </View>
        </View>

        <View style={styles.chamada}>
          {/* Três linhas independentes em vez de quebra dentro do texto: no
              react-native-web o Text aninhado reinicia a caixa de linha e
              abre um vão que não some mexendo em lineHeight. */}
          <View>
            <Text variant="screenTitle" color={colors.textOnBrand} style={styles.titulo}>
              Soluções completas
            </Text>
            <Text variant="screenTitle" color="#4FA6FF" style={styles.titulo}>
              em climatização
            </Text>
            <Text variant="screenTitle" color="#4FA6FF" style={styles.titulo}>
              e refrigeração.
            </Text>
          </View>
          <Text variant="body" color={colors.slate200} style={styles.subtitulo}>
            Prestação de serviços com excelência, qualidade e tecnologia para o máximo desempenho
            dos seus sistemas.
          </Text>
          <View style={styles.risco} />
        </View>

        <View style={styles.lista}>
          {DESTAQUES.map(({ icone: Glifo, titulo, texto }) => (
            <View key={titulo} style={styles.item}>
              <View style={styles.itemIcone}>
                <Glifo size={20} color="#7FC0FF" />
              </View>
              <View style={styles.itemTextos}>
                <Text variant="bodyStrong" color={colors.textOnBrand}>
                  {titulo}
                </Text>
                <Text variant="body" color={colors.slate300} style={styles.itemTexto}>
                  {texto}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.selo}>
          <View style={styles.seloIcone}>
            <ShieldCheck size={20} color="#7FC0FF" />
          </View>
          <View style={styles.itemTextos}>
            <Text variant="bodyStrong" color={colors.textOnBrand}>
              Confiança que você sente, conforto que você vive.
            </Text>
            <Text variant="body" color={colors.slate300} style={styles.itemTexto}>
              Experiência, compromisso e resultados que fazem a diferença.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  painel: {
    // Metade da tela, de ponta a ponta. Sem teto de largura e sem canto
    // arredondado: o painel é o lado esquerdo da página, não um cartão
    // apoiado sobre ela.
    flex: 1,
    minHeight: 640,
    overflow: 'hidden',
    backgroundColor: colors.brandStrong,
  },
  foto: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  veu: { position: 'absolute', inset: 0, backgroundColor: 'rgba(4,18,44,0.90)' },

  conteudo: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 46, height: 46 },

  chamada: { gap: spacing.sm },
  titulo: { fontSize: 34, lineHeight: 40 },
  subtitulo: { maxWidth: 380 },
  risco: { width: 54, height: 3, borderRadius: 2, backgroundColor: '#4FA6FF', marginTop: spacing.xs },

  lista: { gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemIcone: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,192,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(127,192,255,0.22)',
  },
  itemTextos: { flex: 1, gap: 2 },
  itemTexto: { fontSize: 13, lineHeight: 18 },

  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(127,192,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(127,192,255,0.20)',
  },
  seloIcone: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,192,255,0.16)',
  },
});
