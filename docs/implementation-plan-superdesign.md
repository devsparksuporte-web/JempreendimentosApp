# Plano de Implementação Visual e Funcional — JEmpreendimentos

**Projeto de referência:** `29688778-97f3-4a6e-9427-50089a1823a5`  
**Aplicativo:** JEmpreendimentosApp  
**Stack atual:** Expo SDK 57, Expo Router, TypeScript, Supabase, Mapbox GL JS no Web, Storage e RLS.  
**Objetivo:** reproduzir no aplicativo a hierarquia visual dos 20 drafts Superdesign, mantendo os fluxos reais de chamados, técnicos, clientes, PMOC, estoque, QR Code, fotos, checklist, distribuição automática e permissões por perfil.

> Os drafts são referências de interface. Os textos, fotos de equipamentos, avatares e dados numéricos exibidos neles devem ser tratados como exemplos visuais, não como dados de produção.

## 1. Diretrizes visuais consolidadas

A linguagem visual comum deve usar **Plus Jakarta Sans**, fundo branco-gelo `#F8FAFC`, navy profundo `#001F3F`, azul técnico `#0047AB`, verde de sucesso `#2ECC71`, laranja de alerta, cartões brancos, cantos amplos entre 20 e 28 px, badges de status e navegação inferior por perfil. O aplicativo já possui `src/theme/tokens.ts`, `Header`, `Card`, `Button`, `Badge`, `Section`, `ListRow`, `Text` e `IconTile`; a implementação deve ampliar esses componentes antes de criar variações isoladas.

Os assets oficiais da marca devem ser priorizados nesta ordem: `assets/images/brand/jempreendimentos-logo-full.png` para login e telas de marca; `assets/images/brand/jempreendimentos-logo.png` para headers compactos; `assets/images/icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `favicon.png` e `splash-icon.png` para plataformas. Avatares DiceBear, fotos Unsplash e imagem externa de equipamento dos drafts devem ser substituídos por avatar do perfil, fotos reais do Supabase Storage ou ícones técnicos locais.

## 2. Mapeamento dos drafts para o codebase

| Draft de referência | Rota proposta ou existente | Estado atual | Implementação planejada |
|---|---|---|---|
| Dashboard | `src/app/(cliente)/index.tsx`, `src/app/(tecnico)/index.tsx`, `src/app/(admin)/index.tsx` | Existente por perfil | Aplicar cabeçalho da referência, KPIs, próximos serviços, alertas e cartões clicáveis usando consultas reais. |
| Ordem de Serviço | `src/app/(tecnico)/chamado/[id].tsx` e `src/app/chamado/[id].tsx` | Existente | Reorganizar o detalhe em cards de cliente, equipamento, serviço e observações; manter iniciar, status, checklist, fotos e navegação real. |
| Notificações | Nova rota `src/app/notificacoes.tsx` ou por grupo de perfil | Parcial, há tabela de notificações | Criar lista cronológica, estados lida/não lida, filtros e abertura do chamado associado. Adicionar persistência de `read_at`. |
| Rota | `src/app/(tecnico)/rota.tsx` | Existente com Mapbox | Aplicar card inferior da referência, distância/tempo, cliente, destino, `INICIAR ROTA` e `ABRIR NO MAPA`; derivar dados de coordenadas e rota real. |
| Checklist Preventivo | Dentro de `src/app/(tecnico)/chamado/[id].tsx` ou nova rota técnica | Funcional parcialmente | Separar em tela própria se necessário, com progresso, itens obrigatórios, medições, observações e bloqueio de finalização incompleta. |
| Registro Fotográfico | Dentro do detalhe técnico | Funcional parcialmente | Organizar Antes, Depois e Adicionais; permitir câmera/galeria; mostrar preview do Storage, legenda e observação; bloquear conclusão sem evidências exigidas. |
| Assinatura Digital | Nova rota `src/app/(tecnico)/chamado/[id]/assinatura.tsx` | Ausente | Criar canvas de assinatura, limpar, aceite dos termos, salvar imagem no Storage e registrar assinatura vinculada ao atendimento. |
| Histórico do Equipamento | `src/app/(cliente)/equipamento/[id].tsx` e rota técnica equivalente | Parcial | Adicionar abas Histórico, Peças e Garantia, timeline de chamados, fotos e links para OS. |
| Perfil do Cliente | `src/app/(cliente)/perfil.tsx` | Existente | Aplicar avatar, contatos, mapa, equipamentos e histórico de serviços; conectar ligar, WhatsApp e Mapbox. |
| Agenda | Nova rota administrativa/técnica `agenda.tsx` | Ausente ou parcial | Criar calendário, filtros Todos/Hoje/Amanhã/Pendentes/Concluídos e lista diária baseada em `service_calls.scheduled_for`. |
| Contato com Cliente | Nova rota `src/app/(tecnico)/chamado/[id]/contato.tsx` | Ausente | Criar ações de WhatsApp, ligação, mensagem e mensagens rápidas; persistir comunicação e refletir no histórico do chamado. |
| Acompanhamento do Serviço | Nova rota cliente `src/app/(cliente)/chamado/[id]/acompanhamento.tsx` | Parcial no detalhe | Criar timeline derivada de status, fotos, checklist, assinatura e Mapbox; não usar etapas fixas como dados falsos. |
| Equipamentos | `src/app/(cliente)/equipamentos.tsx`, equivalente administrativo | Existente | Aplicar busca, filtros por status, cards e ação de novo equipamento; abrir detalhes reais. |
| Avaliação do Cliente | Nova rota pós-conclusão | Ausente | Persistir nota, pontualidade, funcionamento, sentimento e comentário relacionados ao chamado; permitir pular e avaliar depois. |
| Onboarding | Nova rota no grupo auth | Ausente | Criar três slides, progresso, Próximo, Anterior, Pular e Começar agora; persistir conclusão por usuário/dispositivo. |
| Login | `src/app/(auth)/login.tsx` | Existente | Aplicar composição navy, logo oficial, campos, visibilidade da senha, lembrar-me, recuperação e cadastro sem alterar Supabase Auth. |
| Configurações | `src/components/SettingsScreen.tsx`, rotas por perfil | Existente | Expandir para perfil editável, notificações, privacidade, localização, cache, suporte, termos e logout. |
| Recuperar Senha | Nova rota `src/app/(auth)/recuperar-senha.tsx` | Ausente | Implementar envio real de email por `resetPasswordForEmail`, estados de erro/sucesso e retorno ao login. |
| Relatório do Serviço | Nova rota `src/app/chamado/[id]/relatorio.tsx` | Ausente | Criar relatório com progresso, análise técnica, peças, financeiro, assinatura e ações de compartilhar/email/PDF. |
| Detalhes Técnicos | Nova rota `src/app/(tecnico)/equipamento/[id]/detalhes.tsx` | Parcial | Organizar especificações gerais, componentes, fluido/pressão, drenagem/elétrica e ciclo PMOC com dados editáveis autorizados. |

## 3. Execução por fases

### Fase A — Fundação visual e navegação

Revisar tokens, variantes de Header, navegação inferior, cards de status, estados de loading/erro/vazio e componentes de formulário. Criar componentes reutilizáveis `BrandHeader`, `KpiCard`, `StatusBadge`, `ServiceCard`, `Timeline`, `BottomNav`, `EquipmentCard`, `PhotoEvidenceCard`, `MetricRow` e `ChoiceChip`. Nenhuma tela deve criar cores ou espaçamentos fora dos tokens sem justificativa.

Também devem ser criados os grupos de rotas ausentes para onboarding, notificações, agenda, contato, assinatura, avaliação, relatório e recuperação de senha. Cada rota deve possuir wrapper de perfil quando houver dados restritos.

### Fase B — Autenticação, onboarding e configurações

Aplicar o login do draft ao Supabase Auth existente. Implementar recuperação de senha com estados de validação, email enviado, email inválido e erro de rede. Criar onboarding persistido, sem exibição repetida após conclusão. Ampliar configurações para salvar dados editáveis do perfil, preferências de notificações, privacidade de localização, limpeza de cache, suporte e logout.

### Fase C — Operação do técnico

Reorganizar a Ordem de Serviço em um fluxo único: resumo do cliente/equipamento, rota, contato, status, checklist, registro fotográfico, detalhes técnicos, assinatura e conclusão. Os botões devem ser clicáveis e chamar serviços reais. A conclusão deve exigir checklist obrigatório, fotos Antes/Depois e assinatura quando a regra do tipo de serviço exigir.

A rota Mapbox deve consumir endereços e coordenadas reais. O botão `INICIAR ROTA` atualiza o status para `a_caminho`, e `ABRIR NO MAPA` abre navegação externa. O contato deve oferecer mensagens rápidas persistidas e ações de telefone/WhatsApp. A agenda técnica deve usar os chamados atribuídos e o calendário real.

### Fase D — Experiência do cliente

Adicionar acompanhamento visual da OS com timeline derivada do histórico; cancelamento permitido conforme as regras já aplicadas; avaliação pós-serviço; perfil com equipamentos, histórico, contatos e mapa; e acesso a relatório concluído. O cliente deve enxergar apenas os próprios chamados, equipamentos, mensagens, fotos e documentos conforme RLS.

### Fase E — Administração e documentos

Aplicar dashboard com KPIs reais, alertas de PMOC, estoque, técnicos ativos, chamados urgentes e distribuição automática. Criar agenda administrativa, histórico completo de equipamento, relatório do serviço e detalhes técnicos. As ações `COMPART.`, `EMAIL` e `PDF` devem gerar artefatos reais a partir dos dados do Supabase, sem copiar os textos dos drafts.

## 4. Modelo de dados e backend necessário

Antes de implementar as telas dependentes, confirmar ou criar migrações para `notifications`, `service_call_messages`, `service_signatures`, `service_ratings`, `service_reports`, `equipment_maintenance_history`, `equipment_parts`, `appointments` e campos estruturados para medições técnicas. Todas as tabelas devem possuir `created_at`, `updated_at`, vínculo ao chamado/equipamento quando aplicável e RLS por perfil.

| Recurso | Operação mínima | Permissão |
|---|---|---|
| Notificações | listar, marcar como lida | usuário vê as próprias; admin pode auditar agregados |
| Mensagens | listar e enviar | cliente/técnico vinculados; admin vê tudo |
| Assinatura | salvar imagem e metadados | técnico cria; cliente confirma; admin consulta |
| Avaliação | criar uma por chamado, consultar | cliente cria; admin consulta; técnico vê resumo sem dados indevidos |
| Relatório | montar, compartilhar e exportar | cliente vê próprios; técnico vê atribuídos; admin vê tudo |
| Histórico de equipamento | listar eventos, peças, garantia | cliente vê próprios; técnico atribuído e admin veem conforme escopo |
| Agenda | listar e reagendar | técnico vê próprios; admin gerencia tudo |

As imagens do atendimento devem seguir o padrão `service/{client_id}/{call_id}/{stage}/{timestamp}.jpg` no Storage, com políticas de leitura baseadas no chamado. Nenhuma imagem externa dos drafts deve permanecer como evidência de produção.

## 5. Assets e política de imagens

A logo oficial deve ser aplicada diretamente nos assets do Expo e nos componentes de marca. Para fotos de equipamento, usar imagens cadastradas no Storage; quando não houver foto, usar um ícone técnico local neutro e indicar que a foto não foi registrada. Avatares devem vir de `avatar_url` ou usar fallback gerado localmente, nunca depender de DiceBear em uma tela operacional sem conexão.

As imagens decorativas dos drafts podem orientar composição, mas não devem ser copiadas sem necessidade. O mapa deve continuar sendo Mapbox; o acompanhamento deve usar o mapa real e não uma imagem estática de mapa. Fotos Antes/Depois devem ser sempre uploads reais do atendimento.

## 6. Critérios de aceite

A implementação será considerada concluída quando cada draft possuir uma rota correspondente ou uma adaptação explícita dentro de uma rota existente; todos os CTAs visíveis executarem navegação, mutação ou ação externa real; nenhum texto de exemplo puder ser confundido com dado de produção; as permissões cliente/técnico/admin forem verificadas pelo Supabase; a tela Web e o Expo Go funcionarem com fallback apropriado; o Mapbox carregar somente com variável de ambiente; e `npx tsc --noEmit`, `git diff --check` e `npm run build:web` passarem.

Também deve ser executado um roteiro manual por perfil: cliente cria, acompanha, cancela e avalia; técnico aceita, navega, contata, registra checklist, tira fotos, assina e finaliza; administrador acompanha, redistribui, agenda, ajusta, consulta histórico e exporta relatório.

## 7. Ordem recomendada de implementação

| Prioridade | Entregas |
|---|---|
| P0 | Fundação visual, Login, Recuperar Senha, Onboarding, Dashboard e Ordem de Serviço. |
| P1 | Rota Mapbox, Acompanhamento, Checklist, Registro Fotográfico, Assinatura e Contato. |
| P2 | Notificações, Agenda, Perfil, Equipamentos, Histórico e Detalhes Técnicos. |
| P3 | Avaliação, Relatório exportável, compartilhamento/email, configurações avançadas e refinamentos administrativos. |

## Referências dos drafts

[1]: https://api.superdesign.dev/v1/design-drafts/aab33545-807b-45ba-92d0-4973bf196518/html "JEMPREENDIMENTOS — Dashboard"
[2]: https://api.superdesign.dev/v1/design-drafts/979c57a3-6e42-4f1a-ad60-abfafea2eb19/html "JEMPREENDIMENTOS — Ordem de Serviço"
[3]: https://api.superdesign.dev/v1/design-drafts/4d377012-c5e3-4ad7-893c-ee8826565974/html "JEMPREENDIMENTOS — Notificações"
[4]: https://api.superdesign.dev/v1/design-drafts/e591a1b8-eec2-4b1d-8e24-41c79c39e06f/html "JEMPREENDIMENTOS — Rota"
[5]: https://api.superdesign.dev/v1/design-drafts/bca26148-830c-482d-a524-dd83205a93bd/html "Checklist Preventivo — JEMPREENDIMENTOS"
[6]: https://api.superdesign.dev/v1/design-drafts/4d7ba149-3d93-409d-97cf-1680c50fab61/html "JEMPREENDIMENTOS — Registro Fotográfico"
[7]: https://api.superdesign.dev/v1/design-drafts/fbbc49d6-3115-420c-a0bc-3e32a5511714/html "JEMPREENDIMENTOS — Assinatura Digital"
[8]: https://api.superdesign.dev/v1/design-drafts/0494c8d4-d670-4e6c-bfbb-bfa7ed0a8821/html "JEMPREENDIMENTOS — Histórico do Equipamento"
[9]: https://api.superdesign.dev/v1/design-drafts/ee0c40e9-067d-47c4-acfa-f2285e99f39b/html "JEMPREENDIMENTOS — Perfil do Cliente"
[10]: https://api.superdesign.dev/v1/design-drafts/5d46e067-b7c0-4cf0-b659-63fafba46089/html "Agenda — JEMPREENDIMENTOS"
[11]: https://api.superdesign.dev/v1/design-drafts/2270897b-1945-41f3-a836-2d522f686eac/html "JEMPREENDIMENTOS — Contato com Cliente"
[12]: https://api.superdesign.dev/v1/design-drafts/1360fbeb-a974-4e85-bd22-cf541740ce00/html "JEMPREENDIMENTOS — Acompanhamento do Serviço"
[13]: https://api.superdesign.dev/v1/design-drafts/e8ffdb93-29b2-4633-ae30-c15d79394724/html "JEMPREENDIMENTOS — Equipamentos"
[14]: https://api.superdesign.dev/v1/design-drafts/e20c7a7a-3f24-42f1-8a16-f8b17eecbcd2/html "Avaliação do Cliente — JEMPREENDIMENTOS"
[15]: https://api.superdesign.dev/v1/design-drafts/66d26de4-2ef7-4a4a-ab15-3138be747240/html "JEMPREENDIMENTOS — Onboarding"
[16]: https://api.superdesign.dev/v1/design-drafts/af8d415b-82a6-4c52-b461-ddc6090cdb01/html "JEMPREENDIMENTOS — Login"
[17]: https://api.superdesign.dev/v1/design-drafts/2bc68214-d7b0-428a-a25d-6713641d61c4/html "Configurações — JEMPREENDIMENTOS"
[18]: https://api.superdesign.dev/v1/design-drafts/f6f171f3-f995-4690-b07c-492a449aae63/html "JEMPREENDIMENTOS — Recuperar Senha"
[19]: https://api.superdesign.dev/v1/design-drafts/b84386a9-7bf9-4362-b2d5-2489b95867ab/html "Relatório do Serviço — JEMPREENDIMENTOS"
[20]: https://api.superdesign.dev/v1/design-drafts/a4d5053d-3b43-4057-86cb-8e31e6147e09/html "JEMPREENDIMENTOS — Detalhes Técnicos"
