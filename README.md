# JEmpreendimentos — App

Aplicativo de gestão de instalação, manutenção e assistência técnica de
ar-condicionado da JEmpreendimentos.

React Native · Expo SDK 57 · Expo Router · TypeScript · Supabase

---

## Como rodar no Expo Go

```bash
npm install
npx expo start
```

Escaneie o QR Code com o app **Expo Go** no celular.

O `.env` fica fora do git. Em uma máquina nova, copie `.env.example` para
`.env` e preencha a URL e a anon key do Supabase antes de iniciar.

Se trocar algo no `.env`, reinicie limpando o cache:

```bash
npx expo start -c
```

---

## Configuração obrigatória do banco

O app não funciona antes de aplicar o schema no Supabase.

1. Abra o [SQL Editor do projeto](https://supabase.com/dashboard/project/gahbxnjgldmosowgiksc/sql/new)
2. Cole todo o conteúdo de **`supabase/schema.sql`** e rode

Esse arquivo é a concatenação das duas migrations. Ele é **idempotente**:
rodar de novo não dá erro nem duplica dados. Se preferir em etapas, use
`migrations/0001_init.sql` (estrutura + RLS) e `0002_seed.sql`
(checklists + peças) — o resultado é o mesmo.

Cria 36 tabelas, 73 policies de RLS, 54 índices e 18 triggers.

### Se o banco foi criado antes de 15/08/2026

Rode, uma vez cada, na ordem:

- `migrations/0003_fix_duplicados_e_backfill.sql` — remove checklists
  duplicados (as primeiras versões do seed não eram idempotentes), cria o
  `profiles` de quem se cadastrou antes do trigger existir, e imprime uma
  conferência com os totais esperados (3 checklists, 29 itens, 10 peças).
- `migrations/0004_corrige_demo.sql` — substitui
  `seed_demo_for_current_user()`. A versão anterior criava o chamado já em
  "a caminho", e o trigger de histórico registrava só essa transição: a
  etapa "Aberto" ficava sem horário na timeline. Agora o chamado nasce
  aberto e percorre os status, deixando o trigger montar o histórico real.

Alternativa por CLI, se você tiver o token de acesso e a senha do banco:

```bash
npx supabase login
npx supabase link --project-ref gahbxnjgldmosowgiksc
npx supabase db push
```

### Primeiro acesso

1. Abra o app e toque em **Criar agora** para registrar uma conta
2. Na Home, toque em **Criar dados de exemplo** — isso gera cliente,
   endereço, dois equipamentos, manutenção programada e um chamado em
   andamento vinculados à sua conta

Para desativar o atalho de demonstração em produção:

```sql
drop function public.seed_demo_for_current_user();
```

---

## Estrutura

```
src/
  app/                     rotas (Expo Router)
    _layout.tsx            fontes, sessão e proteção de rota
    (auth)/login.tsx       entrar / criar conta
    (cliente)/             tab bar: Início | Equipamentos | Chamados | IA | Perfil
    chamado/novo.tsx       abertura de chamado por triagem (modal)
    chamado/[id].tsx       acompanhamento com timeline de status
  components/
    ui/                    Card, Badge, Button, ListRow, IconTile, Header, States
    triagem/               chat de triagem
  context/AuthContext.tsx  sessão Supabase + perfil
  services/
    client.ts              consultas do app do cliente
    ai.ts                  roteiro de triagem + costura para o backend de IA
  lib/
    supabase.ts            client (AsyncStorage, sessão persistente)
    format.ts              rótulos de status, datas e nomes em pt-BR
  theme/tokens.ts          design tokens — única fonte de cor/tipografia
  types/database.ts        tipos das tabelas
supabase/migrations/       schema e dados iniciais
.superdesign/              design system e referência dos drafts (fora do git)
```

### Regras de arquitetura

- **Nada de cor ou fonte solta na tela.** Tudo sai de `src/theme/tokens.ts`,
  que espelha `.superdesign/design-system.md`.
- **Violeta é exclusivo de IA.** Qualquer conteúdo gerado por IA aparece
  marcado; nunca é usado como enfeite.
- **A chave da IA nunca entra no app.** O caminho é APP → BACKEND → IA.
  Ver a seam em `src/services/ai.ts`.
- **RLS é a segurança real.** A anon key é pública por design; quem isola
  cliente de cliente são as policies em `0001_init.sql`.

---

## Perfis

| Perfil | Situação |
|---|---|
| **Cliente** | Implementado: Início, Equipamentos, Chamados, IA, Perfil |
| **Técnico** | Schema e RLS prontos; telas pendentes |
| **Administrador** | Schema e RLS prontos; telas pendentes |

O perfil vem de `profiles.role` (`cliente` / `tecnico` / `admin`). Contas
criadas pelo app nascem como `cliente`.

---

## Build

```bash
eas build --platform android --profile preview
```

Projeto EAS: `@devsparksuporte/jempreendimentosapp`
