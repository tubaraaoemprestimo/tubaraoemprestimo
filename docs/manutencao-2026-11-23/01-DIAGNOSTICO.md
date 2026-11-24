# 01 — Diagnóstico

Data: 24/11/2026. Branch: `manutencao/2026-11-23-ficha-cliente` (a partir de `main` @ `148574e`).

## Estado de produção antes da mudança
- Backend Oracle (`tubarao-v2`, ARM, 12 GB): `/home/ubuntu/backend`, commit `148574e`, PM2 `tubarao-backend` online.
- O IP `136.248.115.113` citado no pedido é da VM antiga, **apagada em 02/10/2026**. Acesso atual: `ssh tubarao-vm` (Cloudflare Tunnel).
- Frontend: Vercel, deploy automático do `main` (último: `148574e`, status success).
- Banco: PostgreSQL 15 em container `tubarao_postgres`. Migrações aplicadas manualmente por SQL (não há `prisma migrate deploy`).
- Pasta `J:\AREA DE TRABALHO\Projetos\TUBARÃO EMPRÉSTIMOS LTDA` = cópia antiga; o repositório ativo é `tubarao-demo`.

## Causas encontradas

| Problema relatado | Causa técnica |
|---|---|
| Lista de clientes com rolagem lateral; nome some ao chegar nos botões (vídeo 13.58.26, imagem 14.18.32) | `Customers.tsx`: tabela `min-w-[800px]` dentro de `overflow-x-auto`, 9 botões só com ícone por linha. |
| "Volto e perco tudo" / "trava e tenho que procurar de novo" (áudios 13.51.02, 14.17.53, 14.18.59) | Busca e filtros guardados só em `useState`; sair da tela zerava. Lista renderizava 2.649 linhas de uma vez (trava no celular). Em Contratos só o status era salvo. |
| Não acha foto, vídeo da casa, Instagram e telefones de referência (áudios 13.54.07, 13.55.35, 14.17.53) | Os dados existem (`loan_requests`), mas: (1) o "Detalhes" de Contratos não mostra nada disso; (2) no "Histórico Completo" ficavam espalhados por solicitação, no fim do modal; (3) o botão do histórico só aparecia para quem tinha solicitação e era um ícone sem texto. |

## Achados de segurança (corrigidos)
- `GET /api/customers` e `GET /api/customers/:id` exigiam só login. **Qualquer cliente logado** podia listar CPF/telefone de todos e abrir a ficha completa (documentos, selfie, endereço) de qualquer outro cliente.
- `POST /api/payment-receipts`: cliente podia enviar comprovante para parcela de outro cliente.

## Achados financeiros (NÃO alterados — ver 05)
Ver `05-VALIDACAO-FINANCEIRA.md`.
