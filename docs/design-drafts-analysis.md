# Análise dos drafts Superdesign

## Dashboard — `aab33545-807b-45ba-92d0-4973bf196518`

A referência usa fundo branco-gelo, cabeçalho navy curvo, saudação com nome e avatar, status operacional, data/hora, quatro KPIs em cards, lista de próximos serviços com horário, endereço e badge de estado, alertas importantes e navegação inferior com Home, Equipamentos, ação central, Tarefas e Perfil. A hierarquia é compacta, com cards arredondados, sombras muito leves e acentos azul, verde e laranja.

## Ordem de Serviço — `979c57a3-6e42-4f1a-ad60-abfafea2eb19`

A referência contém cabeçalho com voltar, código da OS e badge de estado; cards separados de cliente, equipamento, serviço e observações. Há ações para ligar e abrir WhatsApp, botão principal `INICIAR SERVIÇO` e botão secundário `DETALHES ADICIONAIS`. O bloco de serviço usa fundo navy forte com dados de tipo, data, horário e técnico; o equipamento apresenta status operacional, número de série e localização.

## Diretriz comum

Manter os fluxos reais do aplicativo, substituir apenas a apresentação e conectar cada ação visual a navegação ou operação Supabase existente. Assets de marca devem ser reutilizados em logo, cabeçalhos, splash, favicon e ícones sem inventar imagens incompatíveis.

## Notificações — `4d377012-c5e3-4ad7-893c-ee8826565974`

A tela apresenta cabeçalho navy com título e subtítulo, seguido por cards de notificações em ordem cronológica. Cada card tem ícone semântico, título, descrição e horário; estados incluem serviço atribuído, deslocamento iniciado, chegada, serviço iniciado, serviço finalizado, garantia próxima e manutenção emergencial. As cores distinguem informação, sucesso, aviso e perigo.

## Rota — `e591a1b8-eec2-4b1d-8e24-41c79c39e06f`

A referência prioriza mapa em tempo real ocupando a área superior, badge de conexão, linha/rota, card inferior com distância, tempo e horário, cliente, prioridade VIP, tipo de serviço, equipamento e destino. Ações principais: `INICIAR ROTA` e `ABRIR NO MAPA`. O layout deve conectar os botões ao Mapbox e ao app externo de navegação, sem substituir a localização real por dados demonstrativos.

## Checklist Preventivo — `bca26148-830c-482d-a524-dd83205a93bd`

A tela apresenta OS, equipamento e cliente no topo, barra de progresso técnico, lista de itens de inspeção com estados concluído/pendente, campos numéricos de temperatura e pressão, observações técnicas e botão fixo `FINALIZAR CHECKLIST`. A implementação deve manter a validação de itens obrigatórios antes de concluir.

## Registro Fotográfico — `4d7ba149-3d93-409d-97cf-1680c50fab61`

O design separa `Antes do Serviço` e `Depois do Serviço`, mostra estado textual do equipamento, permite adicionar por `Câmera` ou `Galeria`, exibe registros adicionais em grid, inclui textarea de observações e botão `SALVAR REGISTRO`. A tela deve usar os uploads reais do Storage e nunca imagens de demonstração no atendimento real.

## Assinatura Digital — `fbbc49d6-3115-420c-a0bc-3e32a5511714`

A tela resume cliente, OS, equipamento e serviço, apresenta área ampla para assinatura manuscrita, ação `LIMPAR ÁREA`, checkbox de declaração de concordância e botão `CONFIRMAR ASSINATURA`. O botão de confirmação deve exigir assinatura e aceite antes de salvar no Storage e concluir o atendimento.

## Histórico do Equipamento — `0494c8d4-d670-4e6c-bfbb-bfa7ed0a8821`

A referência apresenta resumo do ativo com imagem, modelo, status, instalação, garantia, número de série e localização. Abaixo há abas `Histórico`, `Peças` e `Garantia`, seguidas de timeline com serviços, técnico, fotos e links para Ordem de Serviço. As ações devem abrir os registros reais, fotos armazenadas e chamados relacionados.

## Perfil do Cliente — `ee0c40e9-067d-47c4-acfa-f2285e99f39b`

A referência usa cabeçalho navy com avatar, nome e data de relacionamento; três ações de contato (`LIGAR`, `WHATSAPP`, `VER MAPA`); card de contato e localização; lista de equipamentos com status; próxima visita destacada; e histórico de serviços em timeline. Deve reaproveitar dados reais de cliente, equipamentos, Mapbox e chamados.

## Agenda — `5d46e067-b7c0-4cf0-b659-63fafba46089`

A tela organiza mês, dias da semana, filtros `Todos`, `Hoje`, `Amanhã`, `Pendentes` e `Concluídos`, seção de serviços do dia e ação flutuante para novo agendamento. O plano deve conectar os filtros às consultas reais de appointments/service_calls e abrir o detalhe da OS ao selecionar um item.

## Contato com Cliente — `2270897b-1945-41f3-a836-2d522f686eac`

A tela mostra cliente, OS, equipamento e fluxo do serviço; oferece ações `WhatsApp`, `Ligar` e `Mensagem`; possui atalhos de mensagens (`Estou a caminho`, `Cheguei ao local`, `O serviço foi iniciado`, `O serviço foi concluído`), campo livre e botão `ENVIAR MENSAGEM`. Deve conectar à tabela service_call_messages e aos contatos reais do cliente.

## Acompanhamento do Serviço — `1360fbeb-a974-4e85-bd22-cf541740ce00`

A referência combina resumo de equipamento/cliente, mapa com técnico em rota e distância/tempo, e uma timeline numerada de 12 etapas: chamado, agendamento, técnico atribuído, deslocamento, chegada, serviço iniciado, fotos antes, manutenção, fotos depois, checklist, assinatura e concluído. Os estados devem ser derivados de status, fotos, checklist e assinatura reais.

## Equipamentos — `e8ffdb93-29b2-4633-ae30-c15d79394724`

A tela usa busca por modelo/marca, filtros `Todos`, `Operacionais`, `Manutenção` e `Offline`, cards com imagem/ícone, modelo, fabricante, status e endereço, além de ação flutuante para adicionar equipamento. Cada card abre o detalhe do equipamento.

## Avaliação do Cliente — `e20c7a7a-3f24-42f1-8a16-f8b17eecbcd2`

A referência é exibida após serviço concluído, com resumo da OS, técnico e data. Coleta nota de 1 a 5 estrelas, pontualidade sim/não, funcionamento do equipamento, sentimento em escala visual, comentário, botão `ENVIAR AVALIAÇÃO` e opção `Pular por agora`. O plano deve persistir a avaliação e relacioná-la ao chamado.

## Onboarding — `66d26de4-2ef7-4a4a-ab15-3138be747240`

O onboarding apresenta três pilares: Gestão de Serviços, Equipe Conectada e Relatórios Detalhados. Usa indicador de etapa, botões `Próximo`, `COMEÇAR AGORA`, `Anterior` e `PULAR`. Deve ser persistido como concluído por usuário para não reaparecer desnecessariamente.

## Login — `af8d415b-82a6-4c52-b461-ddc6090cdb01`

A referência usa fundo navy/azul, símbolo técnico da marca e título JEMPREENDIMENTOS — Gestão de Serviços. O formulário contém email/usuário, senha com visibilidade, lembrar-me, recuperar senha, `ENTRAR`, cadastro e rodapé. O fluxo deve permanecer conectado ao Supabase Auth real.

## Configurações — `2bc68214-d7b0-428a-a25d-6713641d61c4`

A referência organiza Perfil Profissional com nome, email e telefone editáveis; Notificações com novos serviços, mudanças de status, mensagens do cliente e lembretes diários; Privacidade com localização, histórico de serviços e dados técnicos detalhados; Aplicativo com versão, atualização, limpeza de cache e uso de Wi-Fi; Suporte e Legal com contato, FAQ, feedback, privacidade e termos; e logout. O projeto já possui SettingsScreen, que deve ser ampliado para esses toggles e ações reais.

## Recuperar Senha — `f6f171f3-f995-4690-b07c-492a449aae63`

A referência usa cabeçalho navy com ícone de cadeado e indicador de três etapas. A primeira etapa solicita e-mail corporativo, envia código de segurança, oferece retorno ao login e contato com suporte. Deve conectar a `supabase.auth.resetPasswordForEmail` e apresentar estados de envio, erro e confirmação.

## Relatório do Serviço — `b84386a9-7bf9-4362-b2d5-2489b95867ab`

O relatório mostra OS concluída, cliente, data, horário/duração, técnico e equipamento; uma linha de progresso de agendado, deslocamento, execução e concluído; análise técnica com tipo, problema, solução, peças e observações; resumo financeiro com serviço, deslocamento, peças e total; e ações `COMPART.`, `EMAIL` e `PDF`. Deve gerar dados a partir do atendimento real, com exportação compartilhável sem valores demonstrativos.

## Detalhes Técnicos — `a4d5053d-3b43-4057-86cb-8e31e6147e09`

A referência apresenta imagem do equipamento, status Original, modelo e seções de Informações Gerais, Componentes Técnicos, Fluído & Pressão, Drenagem & Elétrica e Ciclo de Manutenção. Deve ser alimentada por equipamentos, atributos técnicos, PMOC e manutenção cadastrados, com edição restrita a perfis autorizados.
