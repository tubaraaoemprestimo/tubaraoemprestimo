# 04 — Arquivos alterados

Sem alteração de banco (nenhuma migração, nenhum `db push`).

## Frontend
- `pages/admin/Customers.tsx` — cartões no celular (nome + status + "Ficha completa" + WhatsApp + "Mais ações" com todas as ações antigas); tabela mantida no desktop com nome fixo à esquerda; botão "Ficha" para todos; busca sem acento e com CPF/telefone com ou sem máscara; busca e filtros salvos na sessão; renderização em lotes de 50; ficha em tela cheia no celular com "← Voltar", ESC, safe-area, resumo e bloco "Acesso rápido"; link "Abrir contrato".
- `components/admin/CustomerQuickAccess.tsx` (novo) — reúne de todas as solicitações: WhatsApp, Instagram, endereço (copiar/mapa), referências com WhatsApp, fotos/documentos e vídeos (player embutido).
- `pages/admin/Contracts.tsx` — botão "Ficha do cliente" no Detalhes; Detalhes em tela cheia no celular com "← Voltar"; abre contrato por `?loan=<id>`; busca, tipo e modalidade salvos na sessão.

## Backend
- `backend/src/routes/customers.ts` — `GET /` e `GET /:id` passam a exigir `requireAdmin`.
- `backend/src/routes/paymentReceipts.ts` — envio só para parcela do próprio cliente; aprovação/rejeição atômicas (só a partir de PENDING, 409 se já revisado); aprovação bloqueada se a parcela já está paga (exceto quitação total).
- `backend/src/routes/loans.ts` — `admin-edit` valida valor/data, registra `audit_logs` (`LOAN_ADMIN_EDIT`, antes/depois, usuário, IP) na mesma transação.
- `backend/src/services/__tests__/manutencao20261123.test.ts` (novo) — 6 testes de regressão.

## Documentação
- `docs/manutencao-2026-11-23/` (este pacote) + `prints/` (dados fictícios do modo demo).
