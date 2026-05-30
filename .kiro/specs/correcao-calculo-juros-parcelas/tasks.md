# Implementation Plan — Correção do Cálculo de Juros e Exibição por Modalidade

> **ESCOPO DE ARQUIVOS (CRÍTICO).** TODAS as alterações desta correção DEVEM ser feitas na **ÁRVORE DA RAIZ** (`pages/`, `services/`, `backend/`, `App.tsx`, `types.ts` na raiz). **NÃO editar a cópia duplicada `tubaraoemprestimo-main/`** — ela não faz deploy e editá-la causa divergência sem efeito em produção. Pipeline: **frontend → Vercel** (commit/push GitHub → redeploy); **backend → Oracle VM via SSH** (`npm run build` + `pm2 restart all`).
>
> **Modelo conceitual (regra de negócio oficial).** "Parcela" só existe em **MOTO** (36 parcelas reais). **CLT/GARANTIA = dívida + juros (rolagem)**: pagar só o juros mantém a dívida integral e ela rola; pagar juros + valor total quita. **AUTÔNOMO = dívida (valor + 30%) amortizada em 30 diárias**. **A baixa/quitação SEMPRE depende de confirmação do admin — nada quita automaticamente.**
>
> Metodologia bug condition (C/P/¬C) com testes property-based (`fast-check` + `vitest`, sempre `vitest --run`, nunca watch).
> Princípio: mudanças mínimas, aditivas, reversíveis. Nenhum deploy/SSH/pm2/`--apply` é executado automaticamente — esses passos ficam documentados como ações manuais (tarefa 6).
> Tarefas marcadas com `*` são OPCIONAIS (transparência/parametrização), não estritamente necessárias para corrigir o bug.

- [x] 1. Escrever o teste de exploração da bug condition (property-based, ANTES do fix)
  - **Property 1: Fault Condition** - Cálculo Oficial de Cobrança por Modalidade + Contagem Indevida de Parcela em Modalidade sem Parcela
  - **CRITICAL**: Este teste DEVE FALHAR no código não corrigido — a falha confirma que o bug existe
  - **DO NOT attempt to fix the test or the code when it fails** nesta tarefa
  - **NOTE**: Este teste codifica o comportamento esperado — ele validará o fix quando passar após a implementação (ver 3.10)
  - **GOAL**: Surfar contraexemplos que demonstram o bug nos dois ramos da `isBugCondition` do design
  - **Framework**: `fast-check` + `vitest` no backend (Node/TS), instalados como devDependencies do `backend` (script `"test": "vitest --run"`). Rodar com `vitest --run`.
  - **Arquivo**: `backend/src/services/__tests__/interestEngine.bug.test.ts` (já criado)
  - **Scoped PBT Approach** (bug determinístico): scopar a propriedade aos casos concretos que falham, garantindo reprodutibilidade:
    - Ramo A (C_calc): para `profileType ∈ {CLT, GARANTIA, GARANTIA_VEICULO}`, `principal=1000`, `loanAmount=1000`, `D=6` → `calculateOverdueAmount` atual retorna ~R$ 306,00, divergindo da fórmula oficial `(principal×0,30)+(loanAmount×0,07)+(D×20) = R$ 490,00`. Asserir igualdade à fórmula oficial (vai FALHAR).
    - Ramo A (AUTONOMO): o cálculo atual aplica 10% prorrateado igual a CLT, ignorando exclusão de domingo e ausência de 7% → divergente da fórmula oficial do AUTONOMO (vai FALHAR).
    - Ramo A (convergência 2.7): mesma entrada calculada pelo caminho do cron (10%) e por `generate-payment` (30%) retorna valores diferentes (vai FALHAR).
    - Ramo B (C_pay): marcar um **pagamento de juros de rolagem** CLT/GARANTIA como `status='PAID'` e derivar `paidCount = installments.filter(status==='PAID').length`; asserir o invariante de UI `NOT(paidCount == total AND remainingAmount > 0)` → vai FALHAR (o pagamento de juros é contado como se fosse parcela numa modalidade que não possui parcela).
  - As assertions devem corresponder às Expected Behavior Properties do design (Property 1 / `officialCharge`)
  - Rodar o teste no código NÃO corrigido com `vitest --run`
  - **EXPECTED OUTCOME**: Teste FALHA (correto — prova que o bug existe) — confirmado
  - Documentar os contraexemplos encontrados (ex.: `calculateOverdueAmount(300, 6) ≈ 306 != 490`; `paidCount == total` com `remainingAmount = 700` no caso Patricia)
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.9 (defeito); valida 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.10_

- [x] 2. Escrever os testes de preservação (property-based, ANTES do fix)
  - **Property 2: Preservation** - Rolagem Não Amortiza, UI Sem Contagem de Parcelas (CLT/GARANTIA) e Amortização Inalterada
  - **IMPORTANT**: Seguir a metodologia observation-first — observar o comportamento no código NÃO corrigido e fixá-lo em propriedades
  - **Framework**: `fast-check` + `vitest`, `vitest --run`
  - Observar e registrar no código atual, depois escrever propriedades que assertam esses comportamentos no domínio de entradas `¬C`:
    - Amortização AUTÔNOMO (diárias) / MOTO (parcelas): pagar abate `remainingAmount` e marca `PAID` (req. 3.1, 3.9) — propriedade: para qualquer pagamento amortizador, `remainingAfter == max(0, before − amount)`.
    - Rolagem CLT/GARANTIA: confirmar **pagamento de juros de rolagem** mantém `remainingAmount` inalterado (req. 2.9) — propriedade baseline: a dívida não amortiza ao pagar só o juros.
    - Parcela/diária não vencida (`D=0`): mensagem usa valor original, sem juros/multa (req. 3.2) — propriedade: `computeCharge(D=0)` para qualquer perfil não aplica 7% nem R$ 20.
    - Taxas individuais do `Customer` continuam respeitadas pela cascata (req. 3.3).
    - Serviços `LIMPA_NOME` e investimentos `INVESTIDOR` ficam fora do cálculo de juros de mora (req. 3.4, 3.5).
    - Quitação total marca tudo `PAID`, zera `remainingAmount` — **exclusivamente sob confirmação do admin** (req. 3.8).
    - Exibição MOTO mantém "X/Y parcelas pagas" (req. 2.12) — propriedade: `paidCount` (amortizadoras) nunca atinge `total` com saldo > 0, derivada de `i.status==='PAID' && !i.isInterestPayment`.
  - Rodar os testes no código NÃO corrigido com `vitest --run`
  - **EXPECTED OUTCOME**: Testes PASSAM (confirmam o comportamento baseline a preservar). Observação: a propriedade de `paidCount` que depende de `isInterestPayment` deve refletir o baseline atual (default `false`) e ser revalidada após o fix.
  - Marcar a tarefa como concluída quando os testes estiverem escritos, rodados e passando no código não corrigido
  - _Requirements: 2.9, 2.12, 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 3.9_

- [x] 3. Fix — Unificar cálculo de juros/multa e diferenciar pagamento de juros de rolagem de amortização

  - [x] 3.1 Criar a função central pura `interestEngine.computeCharge`
    - Arquivo novo: `backend/src/services/interestEngine.ts` — função pura, sem I/O, testável isoladamente
    - Entrada: `{ profileType, principal, loanAmount, daysOverdue, dueDate, today, monthlyRate, lateFeeDaily=20, finePercent=0.07, sundayPolicyForFine }`; saída: `{ base, jurosMes, multa7, multaDiaria, total, usedRate, breakdown[] }`
    - Resolver a taxa via cascata (2.1): contrato → `Customer.monthlyInterestRate`/`lateInterestMonthly` → `SystemSetting("monthlyInterestRate")` → default **0.30** (nunca 0.10)
    - CLT/GARANTIA/GARANTIA_VEICULO (dívida + juros / rolagem): `D>0` → `(principal×0,30) + (loanAmount×0,07 uma vez) + (D×20)`; `D=0` → só `principal×0,30`
    - AUTONOMO (dívida amortizada em diárias): juros de mora 30% excluindo domingos da contagem (2.6) + R$ 20/dia; SEM os 7%
    - MOTO: parcela fixa; `LIMPA_NOME`/`INVESTIDOR` retornam sem juros de mora
    - Reutilizar helpers existentes de `services/installmentEngine.ts` (`isSunday`, `addBusinessDays`, `calculateLateFee`) para coerência
    - _Bug_Condition: isBugCondition(input) ramo CHARGE — actual(calculateOverdueAmount 10%) != officialCharge_
    - _Expected_Behavior: officialCharge(profileType, principal, loanAmount, D) do design_
    - _Preservation: D=0 sem 7%/R$20; MOTO/serviço/investimento fora de escopo_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Escrever property tests de Fix Checking e Preservation Checking do `interestEngine`
    - **Property 1: Fix Checking** — para `principal>0`, `loanAmount>0`, `D` em range, perfis CLT/GARANTIA/AUTONOMO: `total == officialCharge(...)`, 7% aplicado no máximo uma vez e independente de `D`, `usedRate != 0.10`
    - **Property 2: Preservation** — `D=0` em qualquer perfil não aplica 7%/R$20; MOTO/serviço/investimento sem juros de mora; resolução de cascata de taxa correta
    - Propriedade metamórfica de convergência (2.7): `computeCharge` com a mesma entrada usada pelo cron e por `generate-payment` retorna valor idêntico
    - `fast-check` + `vitest --run`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.3 Integrar o engine no cron de cobrança
    - Arquivo: `backend/src/services/collectionAutomationService.ts`
    - Substituir as chamadas de `calculateOverdueAmount()` (10%) em `processOverdue7/15/30Days` por `interestEngine.computeCharge(...)`
    - Passar `profileType`, `principal`, `loan.amount`, `daysOverdue`; usar o engine como fonte única do `valor_com_juros` (evitar dupla contagem com `applyDailyLateFees`, que continua persistindo `lateFeeAmount`/`fineAccumulated` para saldo/exibição)
    - _Bug_Condition: isBugCondition(input) ramo CHARGE no caminho do cron_
    - _Expected_Behavior: officialCharge(...) via computeCharge_
    - _Preservation: parcela/diária não vencida (D=0) mantém valor original (req. 3.2)_
    - _Requirements: 2.1, 2.2, 2.5, 2.7_

  - [x] 3.4 Integrar o engine na rota generate-payment
    - Arquivo: `backend/src/routes/loans.ts` (rota `POST /:loanId/generate-payment`)
    - Substituir o cálculo inline (30% via SystemSetting) por `interestEngine.computeCharge(...)`, garantindo convergência (2.7) com o cron
    - Centralizar a leitura da taxa dentro do engine/resolver
    - _Bug_Condition: isBugCondition(input) ramo CHARGE no caminho generate-payment_
    - _Expected_Behavior: mesmo resultado do cron para a mesma entrada_
    - _Requirements: 2.7_

  - [x] 3.5 Atualizar templates e pontos de disparo do WhatsApp para enviar o valor correto
    - Arquivos: `backend/src/services/templateService.ts` e pontos de disparo `whatsappAutomationService.ts`, `cron/installmentReminders.ts`, `cron/collectionCron.ts`
    - Garantir que `valor_com_juros` enviado ao cliente venha do `interestEngine` (sistema e WhatsApp coerentes), com a terminologia correta por modalidade (CLT/GARANTIA: pagamento de juros de rolagem; AUTÔNOMO: diária amortizadora)
    - _Bug_Condition: isBugCondition(input) ramo CHARGE (mensagem ao cliente divergente)_
    - _Expected_Behavior: valor_com_juros == officialCharge(...)_
    - _Preservation: lembrete de parcela/diária não vencida segue sem juros/multa (req. 3.2)_
    - _Requirements: 2.1, 2.2, 2.5, 2.7_

  - [x] 3.5.1 (*) OPCIONAL — Adicionar variáveis extras de template para transparência
    - Acrescentar `juros_mes`, `multa_7`, `multa_diaria` além de `valor_com_juros` nos templates de cobrança
    - Apenas transparência; não é necessário para corrigir o bug
    - _Requirements: 2.2, 2.5_

  - [x] 3.6 Adicionar a flag aditiva `isInterestPayment` e setá-la nos pagamentos de juros de rolagem
    - Schema: `backend/prisma/schema.prisma` model `Installment` → `isInterestPayment Boolean @default(false) @map("is_interest_payment")` (aditivo, backward-compatible)
    - Semântica: marca o registro técnico de um **pagamento de juros (rolagem)** de CLT/GARANTIA — conceitualmente NÃO é parcela nem amortização. Default `false` preserva o comportamento atual
    - Setar `isInterestPayment: true` ao **criar** o registro de juros de rolagem em: `paymentReceipts.ts /approve`, `loans.ts /manual-payment`, `collectionAutomationService.ts ensureInterestOnlyOpenInstallments`
    - Ao **confirmar** pagamento de juros (CLT/GARANTIA), garantir a marca no registro pago (mantendo o já-correto: não abater principal). A quitação permanece exclusiva de confirmação do admin (preservar fluxo `isDischarge`/aprovação)
    - **Papel da flag**: no backend é fonte de verdade para (a) não abater a dívida, (b) excluir dos relatórios de parcelas, (c) o gatilho de comissão; no frontend é insumo auxiliar (a decisão de exibição é por `profileType` — ver 3.9)
    - _Bug_Condition: isBugCondition(input) ramo INTEREST_PAYMENT — pagamento de juros tratado como amortização_
    - _Expected_Behavior: pagamento de juros marcado distintamente; remainingAmount inalterado_
    - _Preservation: registros com isInterestPayment=false (default) mantêm o fluxo atual_
    - _Requirements: 2.8, 2.9_

  - [x] 3.7 Corrigir o ponto residual em finance.ts /receipts/:id/approve
    - Arquivo: `backend/src/routes/finance.ts` (rota `PUT /receipts/:id/approve`)
    - Antes de marcar `status='PAID'`, resolver `profileType` do loan (consultando `LoanRequest`) e aplicar a mesma lógica de rolagem das outras 3 rotas: para CLT/GARANTIA não abater principal e marcar `isInterestPayment`; para AUTÔNOMO/MOTO abater normalmente
    - Falha-segura: se `profileType` indeterminado, NÃO abater o principal (2.13)
    - A baixa/quitação final permanece sob confirmação do admin (req. 2.9, 3.8)
    - _Bug_Condition: isBugCondition(input) ramo INTEREST_PAYMENT — remainingAmountChanged (resíduo finance.ts)_
    - _Expected_Behavior: rolagem não abate; amortizador abate normalmente_
    - _Preservation: amortizador (AUTONOMO/MOTO) segue marcando PAID e abatendo (req. 3.1)_
    - _Requirements: 2.8, 2.9, 2.13, 2.14_

  - [x] 3.8 Ajustar o gatilho de comissão de parceiro para contar só amortizadoras
    - Arquivos: `backend/src/routes/loans.ts` (bloco de comissão em `/proof`) e `cron/installmentReminders.ts`
    - Contar `prisma.installment.count({ where: { loanId, status: 'PAID', isInterestPayment: false } })` — pagamentos de juros de rolagem não disparam a liberação 40/30/30
    - _Bug_Condition: isBugCondition(input) ramo INTEREST_PAYMENT — pagamento de juros disparando comissão_
    - _Expected_Behavior: só pagamentos amortizadores (PAID AND isInterestPayment=false) contam_
    - _Preservation: gatilho 40/30/30 continua disparando para amortizadores (req. 3.6)_
    - _Requirements: 3.6_

  - [x] 3.9 Exibição por modalidade no frontend (decisão por `profileType`)
    - **Princípio**: a coluna hoje rotulada "Parcelas" passa a renderizar **condicionalmente por `profileType`** (lido via `c.loanRequest?.profileType`, com fallbacks `isService`/`isInvestment`). A flag `isInterestPayment` é apenas insumo auxiliar (contagem de amortizadoras em MOTO)
    - **MOTO**: manter "X/Y parcelas pagas" (única modalidade com parcelas reais), onde `paidCount = i.status === 'PAID' && !i.isInterestPayment`
    - **CLT/GARANTIA/GARANTIA_VEICULO**: NÃO exibir contagem de parcelas; exibir **saldo devedor** (`remainingAmount`) + **estado do juros do mês** (em dia / em aberto / atrasado)
    - **AUTONOMO**: exibir **saldo amortizado pelas diárias** (`remainingAmount` restante; opcionalmente progresso das diárias)
    - **Invariante de UI**: nunca exibir "N/N pagas" para CLT/GARANTIA; nunca exibir `paid == total` enquanto `remainingAmount > 0`
    - Arquivos (árvore da raiz):
      - `pages/admin/Contracts.tsx`: coluna "Parcelas" (linha ~624) e painel de detalhes (linha ~783) renderizam por `profileType`
      - `services/reportService.ts`: `paidInstallments` (`${paidCount}/${l.installmentsCount}`) preenchido **somente para MOTO**; CLT/GARANTIA exibem saldo + estado do juros; AUTONOMO exibe saldo; `paidCount` exclui `isInterestPayment`
      - `pages/admin/Customers.tsx`: idem onde exibir contagem por contrato
      - Painel do cliente `pages/client/Contracts.tsx` e `pages/client/ClientDashboard.tsx`: mesma decisão por `profileType`
      - `types.ts` (raiz): adicionar `isInterestPayment?: boolean` à interface de `Installment` (opcional, backward-compatible)
    - _Bug_Condition: isBugCondition(input) ramo INTEREST_PAYMENT — UI exibe contagem de parcelas para modalidade sem parcela_
    - _Expected_Behavior: MOTO→contagem; CLT/GARANTIA→saldo + estado do juros; AUTONOMO→saldo; invariante NOT(paid==total AND remaining>0)_
    - _Preservation: remainingAmount continua lido direto do backend, sem recálculo (req. 3.7); MOTO mantém "X/Y parcelas pagas" (req. 2.12)_
    - _Requirements: 2.10, 2.11, 2.12, 3.7_

  - [x] 3.10 Verificar que o teste de exploração da bug condition agora passa
    - **Property 1: Expected Behavior** - Cálculo Oficial de Cobrança por Modalidade + Contagem Correta por Modalidade
    - **IMPORTANT**: Re-rodar o MESMO teste da tarefa 1 (`backend/src/services/__tests__/interestEngine.bug.test.ts`) — NÃO escrever um teste novo
    - O teste da tarefa 1 codifica o comportamento esperado; quando passar, confirma o fix
    - Rodar com `vitest --run`
    - **EXPECTED OUTCOME**: Teste PASSA (confirma que o bug foi corrigido nos dois ramos)
    - _Requirements: Expected Behavior Properties do design (Property 1) — 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.10_

  - [x] 3.11 Verificar que os testes de preservação continuam passando
    - **Property 2: Preservation** - Rolagem Não Amortiza, UI Sem Contagem de Parcelas (CLT/GARANTIA) e Amortização Inalterada
    - **IMPORTANT**: Re-rodar os MESMOS testes da tarefa 2 — NÃO escrever testes novos
    - Rodar com `vitest --run`
    - **EXPECTED OUTCOME**: Testes PASSAM (confirma ausência de regressões)
    - _Requirements: 2.9, 2.12, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9_

- [x] 4. Auditoria completa de contratos/solicitações + script de backfill (dry-run por padrão)
  - **Escopo (requisito explícito do usuário)**: analisar TODOS os contratos (`Loan`) e solicitações (`LoanRequest`) em produção, corrigindo a cobrança no sistema e no WhatsApp

  - [x] 4.1 Tarefa de AUDITORIA COMPLETA (relatório dry-run, sem escrever nada)
    - Varrer todos os `Loan`/`LoanRequest` e produzir um relatório dos afetados, identificando:
      - Contratos CLT/GARANTIA/GARANTIA_VEICULO com `remainingAmount < principalAmount` (abatimento indevido por pagamento de juros de rolagem — caso Patricia)
      - Pagamentos de juros de rolagem marcados `PAID` que entram em `paidCount` (status PAID + valor ≈ `principalAmount × taxa`)
      - Contratos cujo `valor_com_juros` calculado hoje (10%) diverge da fórmula oficial do `interestEngine`
    - Saída: relatório legível (contrato, profileType, antes/depois esperado) — NÃO altera dados
    - _Requirements: 1.1, 1.9, 2.1, 2.9, 2.10_

  - [x] 4.2 Implementar o script de backfill idempotente e reversível
    - Arquivo novo: `backend/scripts/backfill-interest-rollover.ts`
    - `--dry-run` é o DEFAULT (só lista o que seria alterado); execução real só com `--apply` explícito; suporte a `--revert <runId>` via log antes/depois
    - Critério de seleção: `profileType ∈ {CLT, GARANTIA, GARANTIA_VEICULO}`, status ativo, `remainingAmount < principalAmount`
    - Para cada candidato: marcar `isInterestPayment=true` nos pagamentos de juros de rolagem (só se `false`); recalcular `remainingAmount = principalAmount` (rolagem não amortiza; só se ainda não corrigido); registrar log de auditoria
    - Idempotente: segunda execução não muda nada (guarda por `isInterestPayment` e por `remainingAmount == principalAmount`)
    - NÃO executar automaticamente; exigir backup do banco antes do `--apply`
    - _Requirements: 2.9, 2.10_

  - [x] 4.3 Rodar o backfill em dry-run, validar o caso Patricia e validar pós-correção
    - Rodar `backfill-interest-rollover.ts` SEM `--apply` e revisar a lista de contratos afetados
    - Validar caso Patricia: `remainingAmount` R$ 700 → R$ 1.000 (rolagem não amortiza)
    - Validação pós-backfill: relatório de contratos onde `paidCount == total AND remainingAmount > 0` deve retornar zero
    - A execução real (`--apply`) é um passo manual de produção, documentado na tarefa 6
    - _Requirements: 2.9, 2.10_

- [x] 5. Validação final (código e suíte de testes)
  - Rodar `getDiagnostics` em todos os arquivos alterados (`interestEngine.ts`, `collectionAutomationService.ts`, `loans.ts`, `finance.ts`, `templateService.ts`, `whatsappAutomationService.ts`, `cron/installmentReminders.ts`, `cron/collectionCron.ts`, `schema.prisma`, `backfill-interest-rollover.ts`, frontend `reportService.ts`, `Contracts.tsx`, `Customers.tsx`, painel cliente, `types.ts`)
  - Rodar a suíte completa de testes com `vitest --run` (nunca watch)
  - Executar o checklist de validação manual frontend + backend: admin Contracts/Customers e painel cliente exibem **por modalidade** — MOTO "X/Y parcelas pagas" coerente com `remainingAmount`; CLT/GARANTIA saldo devedor + estado do juros (sem contagem); AUTONOMO saldo amortizado; cobrança CLT/AUTONOMO no WhatsApp com valor oficial
  - _Requirements: 2.7, 2.10, 2.11, 2.12, 3.7_

  - [x] 5.1 (*) OPCIONAL — Parametrização de sundayPolicyForFine
    - Tornar `sundayPolicyForFine` parametrizável no engine (default `'CORRIDO'`, preserva comportamento atual de `applyDailyLateFees`); permitir flip para `'PULA_DOMINGO'` sem mudar código
    - Não necessário para corrigir o bug; decisão de negócio em aberto (design "Pontos a Decidir" #1)
    - _Requirements: 2.6_

- [x] 6. Documentar a ordem de deploy segura e rollback (NÃO executar automaticamente)
  - Documentar (sem rodar) a ordem segura: 1) backup do banco; 2) schema aditivo `npx prisma db push` (`isInterestPayment` default false, backward-compatible); 3) deploy backend (SSH Oracle VM → `npm run build` → `pm2 restart all`); 4) backfill em dry-run; 5) backfill real `--apply` após validação; 6) deploy frontend (commit/push GitHub → Vercel)
  - Reforçar o escopo: alterações apenas na **árvore da raiz**; `tubaraoemprestimo-main/` fora do pipeline
  - Documentar pontos de rollback de cada etapa (backend: `git checkout <commit> + build + pm2 restart`; frontend: revert do commit; coluna aditiva permanece inerte; backfill reversível por `--revert`)
  - Documentar janela de segurança: deploy fora dos horários dos crons (cobrança 9h; lembretes 8h/9h)
  - **NOTA**: deploy/SSH/pm2/`--apply` são passos MANUAIS de produção; esta tarefa apenas os documenta
  - _Requirements: n/a (operacional)_

- [x] 7. Checkpoint - Garantir que todos os testes passam
  - Confirmar que `vitest --run` está verde (Property 1 passando, Property 2 passando, sem regressões)
  - Confirmar que a auditoria pós-fix não retorna contratos com `paidCount == total AND remainingAmount > 0` e que CLT/GARANTIA não exibem contagem de parcelas
  - Em caso de dúvidas, perguntar ao usuário
