# Requisitos da reunião — JEmpreendimentos

Documento consolidado a partir das anotações da reunião de 15 de agosto de 2026.

## Direção do produto

O sistema é exclusivo da JEmpreendimentos e deve simplificar a rotina de campo, reduzir preenchimentos manuais e manter o histórico operacional de clientes, equipamentos, chamados, fotos, assinaturas, manutenções e documentos.

## O que foi ajustado nesta etapa

| Frente | Situação |
|---|---|
| Acesso por perfil | Administradores agora entram no painel operacional; clientes continuam na área do cliente. |
| Dashboard operacional | Implementada visão de chamados abertos, urgentes, técnicos disponíveis e manutenções dos próximos sete dias. |
| Histórico de chamados | A navegação do painel abre o chamado real e preserva o fluxo existente de histórico. |
| Manutenção preventiva | O painel contabiliza preventivas com vencimento nos próximos sete dias. |
| Atribuição operacional | O painel exibe técnico atribuído ou informa quando o chamado ainda está sem técnico. |
| Segurança | O painel usa as policies de administrador já aplicadas no Supabase; não há dados fictícios. |

## Requisitos identificados para as próximas evoluções

A reunião também definiu as seguintes frentes, que exigem telas e/ou integrações específicas: app do técnico com leitura de QR Code, fotos obrigatórias antes e depois do serviço, checklist de manutenção, assinatura digital no encerramento, PMOC com geração e impressão de certificados, alertas financeiros de vencimento, estoque com nível mínimo e cotação de peças, notificações por e-mail/app, dashboard em tela de escritório, atribuição automática de técnicos, integração opcional com WhatsApp e exportação para Google Drive.

A geração de boletos, Pix, QR Code de cobrança e automações de Instagram ficou registrada como fase posterior, depois da estabilização do aplicativo principal.

## Regra de prioridade

A prioridade é concluir primeiro o fluxo operacional real: cadastrar equipamento, abrir chamado, atribuir técnico, executar checklist, registrar fotos e assinatura, finalizar o serviço e manter o histórico disponível para o cliente e para o administrador. Integrações externas e automações financeiras devem entrar somente depois que esse fluxo estiver validado em campo.
