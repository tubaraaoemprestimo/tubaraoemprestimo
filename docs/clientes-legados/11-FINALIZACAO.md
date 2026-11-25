# 11 — Finalização: clientes antigos e régua 7/5/3 (25/11/2026)

**Commit em produção:** `900df2d`, o mesmo no GitHub `main`, na Vercel (bundle `index-hkf0qAx_.js`) e no backend Oracle. O PM2 `tubarao-backend` está online, `/api/health` responde 200 e não houve reinícios instáveis.

## Requisitos dos áudios
| Pedido (áudio 08:29) | O que existe agora | Arquivos | Evidência / teste | Produção |
|---|---|---|---|---|
| "Colocar o telefone dela lá" | Botão **Cadastrar cliente antigo** em Gestão de Clientes. Primeiro consulta se o telefone/CPF já existe, depois cadastra | `pages/admin/Customers.tsx`, `LegacyClients.tsx`, `routes/legacyClients.ts` | E2E passos 1–2; prints `homologacao/*-00`, `*-01` | No ar |
| "Quantos por cento é de juros" | Taxa, valor, já pago, saldo, parcelas restantes e vencimento. A soma das parcelas é conferida contra o saldo | `LegacyClients.tsx`, `legacyClients.ts` (`scheduleDates`) | E2E 3–5 (6×500 = 3000; soma errada é recusada); print `*-02` | No ar |
| "Moto, celular… adicionar a categoria" | Usa o catálogo real (CLT, Comércio/Autônomo, Garantia, Moto, Limpa Nome) e mostra a regra de cada serviço. **Celular** fica bloqueado (ver pendências) | `legacyClients.ts` (`/services`) | E2E 2; print `*-03` | No ar |
| "O aplicativo cobrar, entrar na régua direto" | O contrato confirmado entra na régua existente (não foi criada rotina paralela). Saldo não conferido fica fora da régua | `collectionAutomationService.ts`, `collectionRules.ts` | E2E 8 | No ar |
| "Avisava 7 dias, 5 dias, 3 dias" | Painel com liga/desliga, dias de antecedência, template por dia, horário, mensagens programadas, enviadas e falhas, e pausa por contrato | `CollectionRulesPanel.tsx`, `routes/collectionAutomation.ts`, `cron/collectionCron.ts` | E2E 8 (7, 5 e 3 dias gerados; a 2ª rodada não reenvia); prints `*-07..09` | 7 e 3 ativos. **5 disponível, desligado** (1 clique no painel) |
| "Pra não ficar nada manual" | Convite de ativação + mensagem "consultar/regularizar" (sem valores nem CPF) + ativação pelo próprio cliente | `legacyClients.ts`, `ActivateAccount.tsx` | E2E 9–12; prints `*-05`, `*-06`, `*-10` | No ar. Envio automático do convite **desligado** |

## A régua não envia quando
O contrato está quitado ou cancelado, o saldo é zero, o saldo antigo não foi conferido, as mensagens do contrato estão pausadas, há pagamento aguardando conferência ou comprovante pendente, o telefone é inválido ou o cliente pediu para não receber WhatsApp. Cada aviso sai uma única vez por cobrança/gatilho/vencimento (`collection_dispatches`). A rodada acontece 1×/dia, com trava por data e trava no PostgreSQL; o "Executar agora" respeita a mesma trava.

Não há tela de **contestação** no sistema. Esse item não foi aplicado (ver pendências).

## Correções de segurança encontradas nesta fase
- `PUT /loans/:id/installments/:id/proof`: **qualquer usuário logado** conseguia marcar qualquer parcela como PAGA. Agora só admin. O front não usava essa rota; o cliente continua enviando comprovante para conferência.
- Quitação total: o servidor agora exige `confirm=QUITAR`, faz tudo numa transação, bloqueia o clique duplo (2 pedidos simultâneos resultam em 1 quitação + 409) e grava auditoria (`LOAN_SETTLE_ALL`).
- Contagens do painel da régua usavam o status `PENDING`, que não existe nas cobranças, e por isso mostravam sempre 0. Corrigido.

## Contrato 9b0ad3d6 (Daiane dos Santos Silva)
| Momento | Situação | Autorização |
|---|---|---|
| 25/11 00:20 | Quitado por engano ("Quitação Total"): R$ 600 lançados, cobranças de 23/11 e 20/12 marcadas como pagas | — |
| 25/11 12:01 | Revertido: ACTIVE, saldo R$ 1.000, 23/11 e 20/12 abertas, estorno OUT de R$ 600, auditoria `LOAN_SETTLE_REVERTED` | Dono: "pagou somente o juros… reabre e mantenha as cobranças seguintes" |
| 25/11 12:54 | Cobrança de 23/11 (R$ 300) → **PAGA** (baixa administrativa, sem lançamento de caixa). Juros de 20/12 → vencimento **19/12**, R$ 300. Próximo vencimento do contrato → 19/12. Auditoria `INSTALLMENT_ADMIN_SETTLED` | Dono: "como ativo, parcela atual paga e somente cobrar o juros mês que vem em 19/12" |

Estado conferido no fim: ACTIVE, saldo R$ 1.000; 20/11 PAGA, 23/11 PAGA, 19/12 ABERTA R$ 300. Backups: `pre-reversao-daiane-20261125-120102` e `pre-daiane-parcela-atual-20261125-125416`. O dia de vencimento padrão do contrato (20) não foi alterado: a próxima rolagem de juros, depois do pagamento de 19/12, volta a vencer no dia 20 (se o dono quiser dia 19 fixo, basta alterar em "Editar").

## Banco
- Migração `20261125010000_regua_controle` (só acréscimos): `loans.messages_suspended` e a tabela `collection_dispatches`. Aplicada com RC=0; contagens antes e depois iguais (2661 clientes, 71 contratos, 466 cobranças, 296 lançamentos, 152 comprovantes).
- Backup validado antes: `/home/ubuntu/backups/pre-regua-controle-20261125-134643`. Restaurado em container descartável, contagens idênticas, migração ensaiada nele.
- `system_settings.collection_last_run = 2026-11-25`: a régua de hoje já tinha rodado às 9h, então não roda de novo hoje.

## Testes
- Unitários: **155 aprovados, 5 reprovados**. As 5 falhas são as preexistentes da regra AUTONOMO, não alteradas.
- Homologação ponta a ponta numa cópia descartável da produção de hoje (WhatsApp, e-mail e push interceptados; nada enviado): **36/36 verificações**, cobrindo as 16 etapas pedidas (cadastro → contrato → gestão → histórico → lembretes 7/5/3 → convite → ativação → cliente vê o contrato → comprovante → conferência → quitação → régua interrompida) + régua desligada.
- Visual: desktop 1440, iPhone 390, Android 360. 11 telas por aparelho, todas as checagens ok, sem rolagem lateral e sem erros. Prints em `prints/homologacao/` (dados fictícios, modo demo).

## Pendências reais
1. **Ligar o aviso de 5 dias:** Réguas de Cobrança → Configuração → marcar "5 dias" → Salvar. O texto já está cadastrado (cópia do aviso de 7 dias).
2. **Envio automático pelo WhatsApp** (convite e "regularizar"): hoje sai pelo botão "Abrir no WhatsApp". Para automatizar: `LEGACY_WHATSAPP_ENABLED=true` + `pm2 restart tubarao-backend --update-env`.
3. **Celular antigo:** o módulo de celulares tem regras próprias (aparelho, Tabela Price, contrato jurídico). É preciso definir como registrar aparelhos já vendidos antes de liberar.
4. **Investidor:** não é contrato de cobrança (o sistema paga o investidor) e está fora do catálogo de serviços. Não se aplica ao cadastro de devedor antigo.
5. **Contestação:** o sistema não tem esse cadastro. Quando existir, ela deve entrar como mais um motivo de bloqueio em `collectionGate`.
6. Opt-out por cliente: a rota existe (`PATCH /collection-automation/customers/:id/whatsapp`), mas falta um botão na ficha.
7. Tela antiga "Migração de Contratos": quebrada desde antes (a tabela não existe). Sugestão: remover do menu.

## Rollback
- Front: promover o deploy anterior na Vercel (`20adb50`).
- Backend: `git checkout 20adb50` + `npm run build` + `pm2 restart tubarao-backend`. O código anterior ignora as colunas novas.
- Banco: `20261125010000_regua_controle/rollback.sql` (só apaga o histórico de envios), ou o backup `pre-regua-controle-20261125-134643`.
