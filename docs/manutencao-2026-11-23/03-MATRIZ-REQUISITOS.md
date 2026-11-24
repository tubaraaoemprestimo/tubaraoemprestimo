# 03 — Matriz de requisitos

| # | Origem | Problema | Esperado | Arquivos | Front/Back | Risco | Aceite | Status |
|---|---|---|---|---|---|---|---|---|
| R1 | Ptt 14.17.53 01:00, 14.18.59 00:15, Video 13.58.26 | Nome some ao rolar até as ações | Nome sempre junto das ações no celular | `pages/admin/Customers.tsx` | Front | Baixo | 320–430 px sem rolagem lateral, nome no topo do cartão | **Feito** (medido: scrollWidth = clientWidth nas 9 larguras) |
| R2 | Image 14.18.32, Ptt 14.18.59 | Ícone do histórico difícil de achar e só para quem tem solicitação | Botão com texto, para todos | `Customers.tsx` | Front | Baixo | "Ficha completa" visível em todo cartão / "Ficha" na tabela | **Feito** |
| R3 | Ptt 13.54.07, 13.55.35, 14.17.53 00:16 | Foto, documento, vídeo da casa, Instagram, referências escondidos | Bloco no topo da ficha | `components/admin/CustomerQuickAccess.tsx`, `Customers.tsx` | Front | Baixo (só leitura) | "Acesso rápido" mostra WhatsApp, Instagram, endereço (copiar/mapa), referências com WhatsApp, fotos e vídeos de todas as solicitações | **Feito** |
| R4 | Ptt 14.18.10, Video 13.55.30 | Em Contratos (inadimplentes) não há link para essas informações | Link do contrato para a ficha | `pages/admin/Contracts.tsx` | Front | Baixo | Botão "Ficha do cliente" dentro do Detalhes carrega o mesmo bloco | **Feito** |
| R5 | Ptt 13.51.02, 14.17.53 00:51, 14.18.59 00:17 | Voltar zera a busca | Busca e filtros mantidos | `Customers.tsx`, `Contracts.tsx` | Front | Baixo | Testado: busca "maria" persiste após sair e voltar | **Feito** |
| R6 | Ptt 14.17.53 00:59 | Trava | Lista leve | `Customers.tsx` | Front | Baixo | Renderiza 50 por vez + "Mostrar mais" | **Feito** (sem medição em iPhone real) |
| R7 | Complementar | Ficha → contrato | Abrir contrato a partir da ficha | `Customers.tsx`, `Contracts.tsx` | Front | Baixo | `#/admin/contracts?loan=<id>` abre o Detalhes | **Feito** |
| R8 | Segurança | Cliente lê ficha de outro cliente | Só admin | `backend/src/routes/customers.ts` | Back | Médio (rota usada só por telas admin — conferido) | 403 para CLIENT, 200 para ADMIN (teste) | **Feito** |
| R9 | Missão §9 | Aprovação de comprovante duplicável | Idempotente | `backend/src/routes/paymentReceipts.ts` | Back | Médio | 2 aprovações simultâneas = 1 aplicação (teste) | **Feito** |
| R10 | Missão §9, achado 05 | Aprovar comprovante de parcela já paga | Bloquear | `paymentReceipts.ts` | Back | Médio | 409 `INSTALLMENT_ALREADY_PAID` (teste) | **Feito** |
| R11 | Missão §8 | Edição de contrato sem auditoria/validação | Auditoria com antes/depois | `backend/src/routes/loans.ts` | Back | Baixo | `audit_logs` LOAN_ADMIN_EDIT na mesma transação; data inválida = 400 | **Feito** |
| R12 | Missão §7 | Multas R$ 5.180 | Auditar | — | — | **Alto** | Relatório + decisão do responsável | **Pendente de decisão** (05) |
| R13 | Missão §6 | Seção "Financeiro" detalhada na ficha | — | — | — | — | — | **Não feito**: o detalhe financeiro fica no contrato (fonte única do backend); a ficha só conta vencidas/próximo vencimento |
| R14 | Missão §10 | Revisão do painel do cliente | — | — | — | — | — | **Não feito** nesta sessão (sem pedido nos materiais) |
