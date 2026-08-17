# Plano de implementação das telas de referência

## Objetivo

Aplicar os drafts Superdesign ao aplicativo Expo da JEmpreendimentos sem substituir os fluxos reais de autenticação, Supabase, Mapbox, Storage, checklist, fotos, assinatura e permissões por perfil.

## Mapeamento

| Referência | Rota principal | Base existente | Implementação funcional |
|---|---|---|---|
| Dashboard / tela de entrada | `/(tecnico)`, `/(cliente)`, `/(admin)` | Dashboards por perfil já existentes | Trocar cards estáticos por KPIs e chamados reais; cards abrem detalhes. |
| Notificações | nova rota `/notificacoes` por perfil | Nenhuma rota dedicada | Ler eventos do histórico e permitir marcar como lido. |
| Rota / Mapbox | `/(tecnico)/rota` | Mapbox real já integrado | Ajustar visual do draft preservando marcadores e abertura externa de rota. |
| Checklist | detalhe técnico do chamado | Checklist existente no atendimento | Reaplicar card de progresso, itens clicáveis, dados técnicos e finalização protegida. |
| Registro Fotográfico | tela técnica vinculada ao chamado | Serviço de fotos existente | Usar câmera/galeria e Supabase Storage, com estados antes/depois. |
| Assinatura Digital | nova rota técnica por chamado | Nenhuma rota dedicada | Capturar assinatura, salvar evidência e bloquear conclusão sem aceite. |
| Equipamentos | `/(cliente)/equipamentos`, `/(tecnico)/equipamento/[id]` | Rotas existentes | Aplicar cards, filtros e histórico real do equipamento. |
| Contato / Contato com Cliente | novas rotas por chamado | Serviços e detalhes de chamado | Chat/contato real, telefone, WhatsApp e registro do contato. |
| Agenda | nova rota `/agenda` por perfil | Nenhuma agenda dedicada | Calendário baseado em `scheduled_for`, filtros e abertura do chamado. |
| Acompanhamento | nova rota de acompanhamento do chamado | Histórico de status existente | Timeline derivada do histórico e status atual, sem dados simulados. |
| Avaliação de serviço | nova rota por chamado concluído | Nenhum formulário dedicado | Nota, pontualidade, condição do equipamento, comentário e persistência. |

## Ordem de execução

1. Componentes compartilhados de header, bottom navigation, cards, estados vazios, filtros e timeline.
2. Dashboard/tela de entrada, notificações e agenda.
3. Rota Mapbox, acompanhamento e contato com cliente.
4. Checklist, registro fotográfico e assinatura digital.
5. Equipamentos, perfil/contato e avaliação do serviço.
6. Validação por perfil, RLS, Storage, rotas, TypeScript e exportação Web.

## Critérios de aceite

Toda ação visual deve ser clicável e produzir efeito real ou mostrar uma mensagem explícita quando depender de uma configuração ainda ausente. Nenhuma imagem de demonstração, endereço fictício, KPI fixo ou evento simulado deve ser exibido como dado de produção. Cliente só acessa seus dados; técnico acessa chamados atribuídos; administrador possui visão completa conforme as regras existentes.
