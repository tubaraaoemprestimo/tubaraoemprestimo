# Manutenção de 25/11/2026 — relatório

Produção: GitHub/Vercel e backend Oracle em `174dcba`. PM2 `tubarao-backend` online. Módulo Clientes Antigos documentado à parte em `docs/clientes-legados/` (01–10).

## 1. Áudios (transcrição local, faster-whisper; nada enviado para fora)
| Áudio | Pedido |
|---|---|
| 08:29 (57 s) | Cadastrar clientes antigos pelo telefone, com serviço (moto, celular…) e juros, para o app cobrar sozinho pela régua; avisos de 7, **5** e 3 dias. |
| 08:30 (18 s, 10 s, 7 s) + imagem | Um contrato foi marcado como **quitado** por engano: a cliente pagou só os juros pelo link. Pedido de reversão. |
| 08:52 (97 s, 61 s) | Assunto de terceiro (plataforma de cursos) — fora do escopo do sistema, não tratado. |

## 2. Imagem: contrato "Quitado" mostrando "Próx.: 19/12/2026"
- **Causa:** a lista exibia `nextPaymentDate` (campo histórico) mesmo com o contrato encerrado. Só apresentação; nenhum dado errado no banco por isso.
- **Correção (`4bf1867`, `pages/admin/Contracts.tsx`):** contratos COMPLETED/PAID/CANCELLED mostram "Quitado em dd/mm" ou "Cancelado", "Encerrado" no lugar de "Juros do mês", e escondem "Registrar pagamento" e "Quitação total". A "Quitação total" agora exige digitar **QUITAR** e lembra de usar "Baixa ✓" quando o pagamento é só de juros.
- Print original (com dados da cliente) mantido fora do repositório; print depois: `prints/depois/`.

## 3. Reversão da quitação indevida (decisão do dono: "pagou somente o juros… reabre e mantenha as cobranças seguintes")
Contrato `9b0ad3d6`, com backup `/home/ubuntu/backups/pre-reversao-daiane-20261125-120102` e script com travas (aborta se o estado não for exatamente o da quitação):
- contrato volta a **ACTIVE**, saldo **R$ 1.000,00**, último pagamento = o real (24/11, link);
- cobranças de 23/11 e 20/12 voltam a **OPEN** (a de 20/11 segue PAGA);
- lançamento de R$ 600 da quitação **não apagado**: estornado com lançamento de saída e motivo;
- registro em `audit_logs` (`LOAN_SETTLE_REVERTED`).
Conferido após a implantação: ACTIVE / 1000; 20/11 PAID, 23/11 OPEN, 20/12 OPEN.

## 4. Respostas
1. **Pedidos:** ver seção 1.
2. **Implementado:** correção da tela de contratos encerrados + confirmação forte na quitação; reversão do contrato; módulo Clientes Antigos; aviso de 5 dias (desligado até revisar o texto).
3. **Causa da imagem:** data histórica exibida em contrato encerrado.
4. **Corrigido:** sim (`4bf1867`, publicado).
5. **Adicionado:** menu Clientes Antigos (cadastro por telefone, contrato antigo, convite, importação CSV), página `/ativar`.
6. **Regra de cobrança alterada?** Não para contratos atuais. A régua passa a pular contratos marcados como suspensos (nenhum hoje) e quem pedir para não receber WhatsApp (ninguém hoje); o aviso de 5 dias existe mas está desligado.
7. **Juros:** não. 8. **Multa:** não. 9. **Pagamento:** não (só a tela e a confirmação da quitação total).
10. **Dado financeiro de produção modificado?** Só o contrato `9b0ad3d6`, por decisão expressa do dono, com backup, estorno e auditoria.
11. **Banco:** sim, só acréscimos (autorizado), com backup validado e rollback testado — `docs/clientes-legados/05` e `09`.
12. **Arquivos:** `pages/admin/Contracts.tsx`, `App.tsx`, `services/mockApiClient.ts`, `pages/admin/LegacyClients.tsx`, `pages/ActivateAccount.tsx`, `backend/prisma/schema.prisma`, migração + rollback, `backend/src/routes/legacyClients.ts` (+ teste), `returningClients.ts`, `server.ts`, `services/collectionAutomationService.ts`, docs.
13. **Testes:** 151/156 unitários (5 falhas preexistentes do AUTONOMO, não tocadas), 31/31 integração em banco descartável, build, Playwright sem erros e sem rolagem horizontal.
14. **Commits publicados:** `4bf1867` e `174dcba`.
15. **Sistema normal:** sim — `/api/health` 200, PM2 online, 0 reinícios instáveis, Vercel publicada.
16. **Pendências:** ver `docs/clientes-legados/10-RELATORIO-FINAL.md` (ligar o aviso de 5 dias, ligar envio automático do convite, botão de opt-out, remover a tela antiga "Migração de Contratos").

## Rollback
- Frontend: promover o deploy anterior na Vercel (`2d30224`).
- Backend: `git checkout 2d30224` + build + `pm2 restart tubarao-backend` (o código antigo ignora as colunas novas).
- Banco: `rollback.sql` da migração (aborta se houver dados novos) ou backup `pre-clientes-antigos-20261125-092433`.
- Contrato `9b0ad3d6`: estado anterior no backup `pre-reversao-daiane-20261125-120102`.
