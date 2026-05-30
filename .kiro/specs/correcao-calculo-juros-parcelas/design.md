# Correção do Cálculo de Juros e Marcação de Parcela como Paga — Bugfix Design

## Overview

Esta correção atua sobre o fluxo de cobrança e pagamento do sistema **Tubarão Empréstimos** (produção, criticidade ALTA). O objetivo é alinhar o cálculo de juros/multa às regras de negócio oficiais (30% a.m., 7% de inadimplência para CLT/GARANTIA, R$ 20/dia acumulativo) e garantir que o pagamento de juros de rolagem (CLT/GARANTIA) nunca seja contabilizado como amortização nem exibido como contagem de parcelas.

**Modelo conceitual central (regra de negócio oficial):** o conceito de **"parcela" só existe na modalidade `MOTO`** (financiamento de motocicleta, 36 parcelas fixas). Nas demais modalidades de empréstimo **não há parcela** — existe a **dívida** (valor emprestado) e o **juros mensal de 30%**:

- **CLT e GARANTIA = dívida + juros (rolagem).** O cliente paga 30% a.m. sobre o valor emprestado. Pagar **só o juros** mantém a dívida integral e ela **rola** para o mês seguinte (gera 30% de novo). Pagar **juros + valor total** quita. Não há parcela; o que importa é o **saldo devedor** e o **estado do juros do mês** (em dia / em aberto / atrasado). GARANTIA é idêntico a CLT (o bem em posse da empresa não altera o cálculo).
- **AUTÔNOMO = dívida (valor + 30%) amortizada em 30 diárias.** Cada diária paga **abate o saldo** até zerar. Domingo não cobra juros. Multa de R$ 20/dia (sem os 7%). Não é parcela de prestação — é amortização por diárias.
- **MOTO = único caso com parcelas reais** (entrada não reembolsável + 36 parcelas + seguro). Cada parcela paga reduz o saldo. Só aqui faz sentido exibir "X/Y parcelas pagas".
- **Em todas as modalidades, a baixa/quitação SEMPRE depende de confirmação do admin** — nada quita automaticamente.

> **Nota terminológica importante:** o modelo de dados (`Installment`) é usado tecnicamente como o registro de qualquer cobrança/pagamento, inclusive o pagamento mensal de juros de CLT/GARANTIA. Onde este design diz "parcela de juros", leia-se **"pagamento de juros (rolagem) registrado tecnicamente como `Installment`"** — conceitualmente **não é uma parcela**, é a cobrança do juros do mês de uma dívida que rola. A solução proposta (flag `isInterestPayment`) existe justamente para distinguir esse registro técnico de uma amortização real, sem reescrever o modelo de dados.

**Descoberta crítica da validação contra o código real (divergência vs. bugfix.md):** o código em produção já evoluiu além do que o documento de requirements assume. Antes de propor qualquer mudança, este design registra o que **já está corrigido** e isola os defeitos **residuais reais**:

| Defeito previsto no bugfix.md | Estado real no código (validado) |
|-------------------------------|----------------------------------|
| 1.1 `calculateOverdueAmount()` usa 10% hardcoded | **CONFIRMADO.** `backend/src/services/collectionAutomationService.ts` ainda usa `interestRate = 0.10` e prorrateio linear. |
| 1.2 Multa de R$ 20/dia não é calculada nem persistida | **JÁ CORRIGIDO PARCIALMENTE.** `Installment` tem colunas `daysOverdue`, `lateFeeAmount`, `fineAccumulated`; `applyDailyLateFees()` roda no cron e aplica R$ 20/dia (dias corridos). PORÉM o valor da multa **não é somado** ao `valor_com_juros` enviado nos templates. |
| 1.3 Multa de 7% não é calculada | **CONFIRMADO.** Nenhum ponto do código calcula `Loan.amount × 0,07`. |
| 1.5 Divergência cron (10%) vs generate-payment (30%) | **CONFIRMADO.** `routes/loans.ts` usa `SystemSettings("monthlyInterestRate")` fallback `'30'`; cron usa 10%. |
| 1.6/1.7/1.8 Pagamento de juros abate principal indevidamente | **JÁ CORRIGIDO.** As 3 rotas (`paymentReceipts.ts /approve`, `loans.ts /proof`, `loans.ts /manual-payment`) já detectam `profileType ∈ {CLT, GARANTIA, GARANTIA_VEICULO}` e **NÃO** abatem o principal. EXCEÇÃO: `finance.ts /receipts/:id/approve` ainda marca `PAID` sem checar `profileType`. |
| 1.9 `paidCount` conta parcela de juros como paga | **CONFIRMADO E NÃO CORRIGIDO.** Validado no código real: `pages/admin/Contracts.tsx` (`paidCount = (c.installments ?? []).filter(i => i.status === 'PAID').length`, exibido como `{paid}/{total} pagas` nas linhas ~624 e ~783) e `services/reportService.ts` (`paidCount = l.installments.filter(i => i.status === 'PAID').length`, exibido como `${paidCount}/${l.installmentsCount}`). As parcelas de juros (rolagem) são marcadas `status='PAID'`, então essa contagem as inclui e exibe "N/N pagas" com `remainingAmount > 0` **para uma modalidade que não possui parcela** (CLT/GARANTIA). **Este é o defeito central residual e é também um erro conceitual de apresentação.** |

Portanto a estratégia de fix concentra-se em três frentes residuais, todas seguras e reversíveis:

1. **Unificar o cálculo de juros/multa** numa única função pura (`interestEngine`) reutilizada pelo cron e por `generate-payment`, eliminando o 10% e compondo juros + 7% + R$ 20/dia por modalidade.
2. **Diferenciar pagamento de juros (rolagem) de amortização** sem migração destrutiva, usando uma flag aditiva (`isInterestPayment`) em `Installment` com default seguro, para que o saldo, os gatilhos de comissão e a apresentação nunca confundam rolagem com amortização.
3. **Corrigir a apresentação por modalidade no frontend** (e o ponto residual de backend `finance.ts /receipts/:id/approve`): a decisão de exibição passa a ser tomada **por `profileType`** — MOTO continua exibindo "X/Y parcelas pagas"; CLT/GARANTIA passam a exibir **saldo devedor + estado do juros do mês** (sem contagem de parcelas); AUTÔNOMO exibe o **saldo amortizado pelas diárias**.

Nenhuma alteração de enum destrutiva, nenhum `DROP`, nenhum backfill automático. O documento inclui plano de migração idempotente com dry-run para contratos já corrompidos (caso Patricia) e ordem de deploy com pontos de rollback.

## Escopo de Arquivos / Ambiente

> **Decisão de ambiente (crítica para evitar editar a árvore errada).** O repositório contém **duas cópias** do projeto: a **árvore da raiz** e uma cópia duplicada em **`tubaraoemprestimo-main/`** (que possui seus próprios `pages/`, `services/`, `backend/`, `App.tsx`, `types.ts`, etc., rastreados no git — ~336 arquivos). **TODAS as alterações desta correção DEVEM ser feitas na ÁRVORE DA RAIZ.** A árvore da raiz é a que faz **deploy**:
> - **Frontend** (`pages/`, `services/`, `App.tsx`, `types.ts` na raiz) → **Vercel** (commit/push GitHub → redeploy automático).
> - **Backend** (`backend/`) → **Oracle VM via SSH** (`npm run build` + `pm2 restart all`).
>
> A cópia **`tubaraoemprestimo-main/` NÃO deve ser editada** sob nenhuma circunstância — não faz deploy e editá-la causaria divergência/confusão sem efeito em produção. Toda referência de arquivo neste design (em "Fix Implementation", "Migração" e "Ordem de Deploy") aponta para a **árvore da raiz**, salvo indicação explícita em contrário.

### Mapa de arquivos da árvore da raiz (validado contra o código real)

**Frontend (deploy Vercel):**

| Arquivo (raiz) | Rota | Papel na correção |
|----------------|------|-------------------|
| `pages/admin/Dashboard.tsx` | `/admin` | Dashboard admin (visão geral; não exibe contagem de parcelas hoje). |
| `pages/admin/Contracts.tsx` | `/admin/contracts` | **Onde aparece o "1/1 pagas" e o "Restante" da Patricia.** `paidCount = (c.installments ?? []).filter(i => i.status === 'PAID').length` (linha ~447); exibido como `{paid}/{total} pagas` na coluna "Parcelas" (linha ~624) e no painel de detalhes (`{paidCount(selected)}/{...} pagas`, linha ~783). Já lê `c.loanRequest?.profileType` (filtro de modalidade e `getProfileBadge`). |
| `pages/admin/Requests.tsx` | `/admin/requests` | Solicitações (aprovação de pedidos; não é alvo direto, mas compartilha o modelo de `profileType`). |
| `pages/admin/Customers.tsx` | `/admin/customers` | Clientes (edição de taxas via `PUT /api/customers/:id/rates`; preservar — req. 3.3). |
| `services/reportService.ts` | — | **Onde `paidCount` é calculado para relatórios.** `paidCount = l.installments.filter(i => i.status === 'PAID').length`; exibido como `${paidCount}/${l.installmentsCount}` no relatório de contratos (coluna "Pagas"). |
| `pages/client/Contracts.tsx` | `/client/contracts` | Painel do cliente — contratos. Hoje rotula a contagem como "Cobranças" (`selectedLoan.installmentsCount`) e lista status das `installments`. |
| `pages/client/ClientDashboard.tsx` | `/client/dashboard` | Painel do cliente — início. Lista próximas parcelas/cobranças em aberto. |
| `types.ts` (raiz) | — | Interface de `Installment` / `Contract`; receberá `isInterestPayment?: boolean` (aditivo, opcional). |
| `App.tsx` (raiz) | — | Define as rotas acima (`<Route path="/admin/contracts" ... >` etc.). |

**Backend (deploy Oracle VM via SSH):**

| Arquivo (raiz) | Papel na correção |
|----------------|-------------------|
| `backend/src/services/collectionAutomationService.ts` | `calculateOverdueAmount()` (10% hardcoded) e `applyDailyLateFees()` (R$ 20/dia). Cron de cobrança. |
| `backend/src/services/interestEngine.ts` (novo) | Função pura central de cálculo. |
| `backend/src/routes/loans.ts` | `POST /:loanId/generate-payment` (30% via SystemSetting); rotas `/proof`, `/manual-payment`; bloco de comissão. |
| `backend/src/routes/paymentReceipts.ts` | `PUT /:id/approve` (confirmação de pagamento). |
| `backend/src/routes/finance.ts` | `PUT /receipts/:id/approve` (ponto residual sem checagem de `profileType`). |
| `backend/prisma/schema.prisma` | Model `Installment` (adicionar `isInterestPayment`). |
| `backend/scripts/backfill-interest-rollover.ts` (novo) | Backfill idempotente do caso Patricia. |

## Glossary

- **Dívida**: valor emprestado (`Loan.principalAmount`/`Loan.amount`). Em CLT/GARANTIA é o que "rola" e gera 30% ao mês; em AUTÔNOMO é a base que (com +30%) é amortizada pelas diárias.
- **Parcela**: prestação que amortiza o saldo. **Só existe em `MOTO`** (36 parcelas fixas). NÃO existe em CLT/GARANTIA (dívida + juros) nem em AUTÔNOMO (diárias).
- **Pagamento de juros (rolagem)**: cobrança mensal de 30% do principal em CLT/GARANTIA. Tecnicamente registrado como um `Installment`, mas conceitualmente **não é parcela** — não amortiza a dívida. Pagar só o juros mantém a dívida integral; ela rola para o mês seguinte.
- **Diária (AUTÔNOMO)**: cobrança de amortização. A dívida (valor + 30%) é dividida em 30 diárias; cada diária paga abate o saldo até zerar. Domingo não cobra juros.
- **Estado do juros do mês (CLT/GARANTIA)**: situação do juros do ciclo corrente — **em dia** (juros do mês pago / sem `Installment` de juros em aberto), **em aberto** (juros do mês ainda não pago, dentro do prazo), **atrasado** (juros do mês vencido sem pagamento). Derivado da existência/situação da `Installment` de juros em aberto, não de contagem de parcelas.
- **Bug_Condition (C)**: Predicado que identifica entradas onde o sistema se comporta incorretamente. Tem dois ramos: (C_calc) cálculo de cobrança divergente da fórmula oficial; (C_pay) pagamento de juros de rolagem tratado como amortização (reduz saldo) e/ou exibido como contagem de parcelas em modalidade sem parcela.
- **Property (P)**: Comportamento desejado. Para C_calc: `valor_com_juros` igual à fórmula oficial por modalidade. Para C_pay: `remainingAmount` inalterado no pagamento de juros e UI sem contagem de parcelas para CLT/GARANTIA.
- **Preservation (¬C)**: Entradas não-bugadas que devem permanecer idênticas: amortizadores (AUTÔNOMO diárias / MOTO parcelas), parcelas/diárias não vencidas, serviços (LIMPA_NOME), investimentos (INVESTIDOR), quitação total confirmada pelo admin.
- **F / F'**: Função original (atual) / função corrigida.
- **profileType**: `LoanRequest.profileType` ∈ {`CLT`, `AUTONOMO`, `GARANTIA`, `GARANTIA_VEICULO`, `MOTO`, `LIMPA_NOME`, `INVESTIDOR`}. Determina a modalidade de cobrança e o modelo de dívida. No frontend é lido via `c.loanRequest?.profileType`, com fallbacks `isService`/`isInvestment` já existentes.
- **Rolagem de juros**: Modalidade CLT/GARANTIA onde o pagamento mensal é só de juros (30% do principal); a dívida não amortiza e "rola" para o mês seguinte. Quitação só com juros + valor total e confirmação do admin.
- **Amortização**: Modalidade AUTÔNOMO (diárias) / MOTO (parcelas) onde cada pagamento reduz o `remainingAmount`.
- **interestEngine**: Nova função pura central de cálculo (proposta), a única fonte de verdade para juros/multa, reutilizada por cron e rota.
- **calculateOverdueAmount**: Função atual em `collectionAutomationService.ts` que usa 10% hardcoded (a ser substituída pelo interestEngine).
- **applyDailyLateFees**: Rotina já existente no cron que persiste `lateFeeAmount`/`fineAccumulated`/`daysOverdue` (R$ 20/dia, dias corridos).
- **isInterestPayment**: Flag booleana aditiva proposta em `Installment` para marcar pagamentos de juros de rolagem (default `false` = comportamento atual preservado). Permite distinguir o registro técnico de juros de uma amortização real.
- **paidCount**: Contagem de **parcelas amortizadoras** pagas (`status='PAID' AND NOT isInterestPayment`). Conceitualmente válida **apenas para MOTO**; para CLT/GARANTIA a UI não deve exibir contagem de parcelas (deve exibir saldo + estado do juros) e para AUTÔNOMO deve exibir o saldo amortizado pelas diárias. A escolha do que renderizar é feita por `profileType`, não pela contagem em si.
- **Loan.amount / Loan.principalAmount**: Valor emprestado original / valor final aprovado. Base dos 30% e dos 7%.

## Bug Details

### Fault Condition

O bug se manifesta em dois ramos independentes que compartilham a mesma causa-raiz (ausência de uma fonte única de cálculo e de uma marca distinta para parcela de juros).

**Ramo A — Cobrança (C_calc):** quando o cron de cobrança monta `valor_com_juros` para uma parcela em atraso, o valor calculado por `calculateOverdueAmount()` (10% prorrateado) diverge da fórmula oficial dado `profileType`, `principal`, `Loan.amount` e dias de atraso `D`. A fórmula oficial permanece: CLT/GARANTIA → 30% + 7% (uma vez) + R$ 20/dia; AUTÔNOMO → 30% (excluindo domingo) + R$ 20/dia, **sem** os 7%.

**Ramo B — Pagamento (C_pay):** quando um pagamento de juros de rolagem (CLT/GARANTIA) é confirmado, o sistema o trata como amortização. Para CLT/GARANTIA — modalidades **sem conceito de parcela** — a condição de bug abrange duas manifestações: (a) o `remainingAmount` é reduzido pelo pagamento de juros (rolagem não amortiza: a dívida deve permanecer integral); e (b) a UI exibe **contagem de parcelas** ("N/N pagas") para uma modalidade que não possui parcela, em vez de saldo devedor + estado do juros do mês. (O abatimento do principal em si já está corrigido nas 3 rotas principais; restam o ponto residual `finance.ts` e a apresentação no frontend.)

**Especificação Formal:**
```
FUNCTION isBugCondition(input)
  INPUT: input do tipo ChargeOrPayment
  OUTPUT: boolean

  // ── Ramo A: cobrança com cálculo divergente ──
  IF input.kind == 'CHARGE' THEN
    expected := officialCharge(input.profileType, input.principal,
                               input.loanAmount, input.daysOverdue)
    actual   := currentCharge(input)          // usa calculateOverdueAmount (10%)
    RETURN actual != expected
  END IF

  // ── Ramo B: pagamento de juros (rolagem) tratado como amortização ──
  // CLT/GARANTIA não possuem parcela: a dívida rola e a UI deve mostrar
  // saldo + estado do juros, nunca contagem de parcelas.
  IF input.kind == 'INTEREST_PAYMENT' THEN
    isRollover := input.profileType IN ['CLT', 'GARANTIA', 'GARANTIA_VEICULO']
    RETURN isRollover AND (
             remainingAmountReducedByInterest(input)  // (a) rolagem amortizou indevidamente
             OR uiShowsInstallmentCount(input)         // (b) UI exibe "N/N pagas" p/ modalidade sem parcela
           )
  END IF

  RETURN false
END FUNCTION
```

Onde `officialCharge` é a fórmula oficial:
```
FUNCTION officialCharge(profileType, principal, loanAmount, D)
  jurosMes := principal * 0.30                        // taxa resolvida via cascata; default 0.30

  IF profileType IN ['CLT', 'GARANTIA', 'GARANTIA_VEICULO'] THEN
    IF D <= 0 THEN RETURN jurosMes                     // não venceu: só juros do mês
    multa7  := loanAmount * 0.07                        // uma vez por ciclo de atraso
    multaDia := D * 20
    RETURN jurosMes + multa7 + multaDia
  END IF

  IF profileType == 'AUTONOMO' THEN
    diasJuros := D - countSundays(dueDate, today)       // domingo não cobra juros
    jurosMora := proRata(principal, 0.30, diasJuros)
    multaDia  := lateFeeDays(D) * 20                     // dias corridos (parametrizável)
    RETURN baseParcela + jurosMora + multaDia
  END IF

  RETURN baseParcela                                     // MOTO: parcela fixa; serviços/investimento fora de escopo
END FUNCTION
```

### Examples

- **Cobrança CLT em atraso (defeito 1.1/1.3):** principal R$ 1.000, `Loan.amount` R$ 1.000, D=6. Atual: `300 × (1 + 0,10 × 6/30) = R$ 306,00`. Oficial: `300 + 70 + 120 = R$ 490,00`. **Diverge.**
- **Cobrança CLT sem atraso (2.3):** principal R$ 1.000, D=0. Oficial: `R$ 300,00` (só juros, sem 7%, sem R$ 20). Esperado correto.
- **Cobrança AUTONOMO em atraso (2.5):** sem os 7%; só juros de mora 30% (excluindo domingos) + R$ 20/dia. Atual aplica 10% prorrateado igual para todos. **Diverge.**
- **Pagamento de juros CLT (caso Patricia, 1.9):** principal R$ 1.000, paga juros R$ 300. Resultado atual: registro de juros marcado `PAID`, a UI conta como parcela e em contratos já corrompidos `remainingAmount` ficou R$ 700 (deveria ser R$ 1.000). Esperado: `remainingAmount = R$ 1.000` (a dívida rola), a tela **não** exibe contagem de parcelas para CLT/GARANTIA — exibe saldo devedor R$ 1.000 + estado do juros do mês (em dia, recém-pago). A quitação só ocorreria com pagamento de R$ 1.300 confirmado pelo admin.
- **Pagamento amortizador AUTÔNOMO (preservação 3.1):** paga diária R$ 50. Esperado: `PAID`, `remainingAmount -= 50` (amortiza o saldo). Comportamento inalterado; quitação final confirmada pelo admin.
- **Convergência (2.7):** mesma parcela CLT D=6 disparada pelo cron e por `generate-payment` deve retornar o mesmo valor (hoje retornam R$ 306 vs R$ 300+...). **Diverge.**

## Expected Behavior

### Preservation Requirements

**Comportamentos que NÃO podem mudar:**
- Pagamento amortizador — AUTÔNOMO (diárias) e MOTO (parcelas) — em qualquer rota: marca `status='PAID'`, abate `remainingAmount`, marca contrato `PAID/COMPLETED` quando zera, sempre sob confirmação do admin (req. 3.1, 3.9).
- Parcela/diária não vencida (`D=0`): mensagem com valor original, sem juros nem multa (req. 3.2).
- Taxas individuais do `Customer` (`monthlyInterestRate`, `lateInterestMonthly`, `lateInterestDaily`, `lateFixedFee`) continuam editáveis e usadas na cascata (req. 3.3).
- `LIMPA_NOME` (isService) e `INVESTIDOR` (isInvestment) permanecem fora do cálculo de juros de mora (req. 3.4, 3.5).
- Gatilho de comissão de parceiro 40/30/30 continua disparando, mas contabilizando apenas pagamentos amortizadores (não pagamentos de juros de rolagem) (req. 3.6).
- `remainingAmount` exibido no frontend continua lido diretamente do backend, sem recálculo no cliente (req. 3.7).
- Quitação total (`settle-all`, `isDischarge`) continua marcando tudo `PAID`, zerando `remainingAmount`, marcando contrato `COMPLETED` — e permanece **exclusivamente sob confirmação do admin** (req. 3.8). Nada quita automaticamente.
- Exibição de **MOTO** mantém "X/Y parcelas pagas" — é a única modalidade com parcelas reais (req. 2.12, 3.9).
- Comportamento já correto das rotas `paymentReceipts /approve`, `loans /proof`, `loans /manual-payment` para CLT/GARANTIA (não abater principal) deve ser **mantido**, apenas reforçado com a flag e com a apresentação por modalidade.

**Escopo (entradas não afetadas pelo fix):**
- Pagamentos amortizadores (AUTÔNOMO diárias, MOTO parcelas).
- Parcelas/diárias não vencidas (D=0) de qualquer perfil.
- Contratos de serviço (LIMPA_NOME) e investimento (INVESTIDOR).
- Quaisquer registros onde `isInterestPayment == false` (default), que mantêm exatamente o fluxo atual.
- A exibição de MOTO ("X/Y parcelas pagas") permanece intacta.

> O comportamento correto esperado para entradas bugadas está definido na seção **Correctness Properties** (Property 1).

## Hypothesized Root Cause

Com base na análise do código real, as causas-raiz são:

1. **Ausência de fonte única de cálculo (interest engine):** existem dois caminhos de cálculo independentes — `calculateOverdueAmount()` (10% no cron) e o bloco inline em `routes/loans.ts /generate-payment` (30% via SystemSetting). Eles divergem por construção. Não há função compartilhada, então qualquer regra (7%, R$ 20/dia, exclusão de domingo) precisaria ser duplicada e tende a ficar inconsistente.
   - `collectionAutomationService.ts` → `calculateOverdueAmount(amount, days)` com `interestRate = 0.10`.
   - `loans.ts` → `monthlyRate = parseFloat(setting?.value || '30')/100`.
   - A multa diária (`applyDailyLateFees`, R$ 20/dia) já persiste `fineAccumulated`, mas esse valor **nunca é lido** ao montar `valor_com_juros`.
   - A multa de 7% não existe em nenhum lugar.

2. **Falta de marca semântica para "pagamento de juros" e apresentação única para todas as modalidades:** o modelo `Installment` não distingue o pagamento de juros (rolagem) de um pagamento amortizador. As rotas de pagamento marcam `status='PAID'` para ambos. As correções já feitas nas 3 rotas principais resolveram o abatimento do principal via checagem de `profileType` em tempo de execução, mas o frontend (e o gatilho de comissão) continua olhando só `status==='PAID'`, sem saber que aquele registro era juros, e exibe **contagem de parcelas** ("N/N pagas") para CLT/GARANTIA — modalidades que **não possuem parcela**. O correto seria, por modalidade: MOTO exibe contagem de parcelas; CLT/GARANTIA exibem saldo devedor + estado do juros do mês; AUTÔNOMO exibe saldo amortizado pelas diárias. Validado no código real em `pages/admin/Contracts.tsx` (`paidCount` e `{paid}/{total} pagas`) e `services/reportService.ts` (`${paidCount}/${l.installmentsCount}`).

3. **Ponto residual não coberto pela correção anterior:** `finance.ts /receipts/:id/approve` marca `status='PAID'` sem consultar `profileType`, ficando fora do padrão das outras três rotas. É um caminho secundário (recibos em JSON em `SystemSetting`), porém ainda capaz de marcar parcela de juros como paga.

4. **Dados já corrompidos em produção:** contratos CLT/GARANTIA que tiveram parcela de juros marcada `PAID` e principal abatido **antes** das correções parciais (caso Patricia: `remainingAmount` R$ 700 em vez de R$ 1.000). Esses registros precisam de backfill idempotente para restaurar `remainingAmount = principalAmount` e remarcar as parcelas de juros, sem afetar amortizadores legítimos.

## Correctness Properties

Property 1: Fault Condition - Cálculo Oficial de Cobrança por Modalidade

_For any_ entrada de cobrança onde a bug condition se verifica (`isBugCondition` retorna `true` no ramo CHARGE), a função corrigida `interestEngine.computeCharge` SHALL produzir `valor_com_juros` igual à fórmula oficial: para CLT/GARANTIA em atraso, `(principal × 0,30) + (Loan.amount × 0,07) + (D × 20)`, com o componente 7% aplicado no máximo uma vez por ciclo e independente de `D`; para AUTONOMO, `parcela + jurosMora(30%, excluindo domingos) + (D × 20)` sem o componente 7%; e, em qualquer caso, nunca usando a taxa de 10%.

**Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Rolagem Não Amortiza, UI Sem Contagem de Parcelas e Amortização Inalterada

_For any_ entrada onde a bug condition NÃO se verifica do ponto de vista de amortização — pagamentos de juros de rolagem (CLT/GARANTIA) e pagamentos amortizadores (AUTÔNOMO diárias / MOTO parcelas) — a função corrigida SHALL preservar o comportamento correto do modelo de dívida:

- **Rolagem CLT/GARANTIA:** ao confirmar pagamento de juros, `remainingAmount_after == remainingAmount_before` (a dívida rola, não amortiza); e a UI **nunca** SHALL apresentar contagem de parcelas ("N/N pagas") para CLT/GARANTIA — SHALL exibir saldo devedor + estado do juros do mês. Invariante de UI: para CLT/GARANTIA a tela não renderiza "N/N pagas".
- **Amortização AUTÔNOMO/MOTO:** o resultado SHALL ser idêntico ao da função original (marca `PAID`, abate saldo, dispara comissão apenas para amortizadores); MOTO mantém "X/Y parcelas pagas".
- **Quitação:** a baixa/quitação SHALL ocorrer **exclusivamente por confirmação do admin** (nunca automática), preservando o fluxo `isDischarge`/aprovação, e mantendo serviços (LIMPA_NOME) e investimentos (INVESTIDOR) fora de escopo.

**Validates: Requirements 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9**

## Fix Implementation

> Princípio geral: mudanças **aditivas, reversíveis e backward-compatible**. Nenhuma remoção/renomeação de campo ou enum existente. A flag nova tem default que reproduz o comportamento atual.

### Decisão de design: flag aditiva vs. novo status (com recomendação)

| Alternativa | Impacto | Recomendação |
|-------------|---------|--------------|
| **A. Novo status `INTEREST_PAID`** no enum de `Installment.status` | Alto risco: `status` é string usada em dezenas de queries (`status: 'PAID'`, `status: { in: [...] }`), em `reportService`, dashboards, gatilho de comissão (`count status PAID`), `paidCount` em múltiplas telas. Introduzir novo valor faria todas essas queries ignorarem/contarem errado parcelas de juros de forma imprevisível. | ❌ Evitar |
| **B. Flag booleana `isInterestPayment`** em `Installment` (default `false`) | Baixo risco: campo novo aditivo. Parcelas de juros pagas continuam `status='PAID'` (queries existentes não quebram), mas ganham marca semântica. `paidCount` e comissão passam a filtrar `status==='PAID' AND NOT isInterestPayment`. | ✅ **Recomendada** |
| C. Campo `paymentType` (enum string) | Equivalente a B em segurança, porém mais verboso; útil se houver mais de 2 tipos no futuro. | Alternativa aceitável |

**Recomendação:** Alternativa **B** (`isInterestPayment: Boolean @default(false)`). É a menor mudança que resolve o ramo B sem regredir nenhum consumidor de `status`. Reversível: basta parar de ler a flag (o default `false` reproduz o estado atual).

### Mudança 1 — Função central de cálculo (interest engine)

**Arquivo (novo):** `backend/src/services/interestEngine.ts`

**Função:** `computeCharge(params): ChargeBreakdown` — pura, sem I/O, testável isoladamente.

```
INPUT:  { profileType, principal, loanAmount, daysOverdue, dueDate, today,
          monthlyRate (resolvida via cascata), lateFeeDaily=20, finePercent=0.07,
          sundayPolicyForFine }
OUTPUT: { base, jurosMes, multa7, multaDiaria, total, breakdown[] }
```
- Resolve a taxa via cascata (2.1): contrato → `Customer.monthlyInterestRate`/`lateInterestMonthly` → `SystemSetting("monthlyInterestRate")` → default **0.30**.
- CLT/GARANTIA/GARANTIA_VEICULO: aplica 7% (uma vez) + R$ 20×D quando `D>0`; só juros quando `D=0`.
- AUTONOMO: exclui domingos da contagem de juros de mora; sem 7%.
- MOTO: parcela fixa; serviços/investimento retornam sem juros de mora.
- Reutiliza os helpers já existentes em `services/installmentEngine.ts` (`isSunday`, `addBusinessDays`, `calculateLateFee`) para coerência.

### Mudança 2 — Cron de cobrança usa o engine

**Arquivo:** `backend/src/services/collectionAutomationService.ts`

- Remover/depreciar `calculateOverdueAmount()` (10%). Substituir todas as chamadas em `processOverdue7/15/30Days` por `interestEngine.computeCharge(...)`.
- Passar `profileType` (já disponível via `getCollectionContext`/`loanRequest`), `principal`, `loan.amount`, `daysOverdue`, e `fineAccumulated` já persistido por `applyDailyLateFees` (evitar dupla contagem: o engine deve ser a fonte única; `applyDailyLateFees` continua persistindo para exibição/saldo, mas o `valor_com_juros` vem do engine).
- Acrescentar variáveis de template (`juros_mes`, `multa_7`, `multa_diaria`) além de `valor_com_juros` para transparência.

### Mudança 3 — generate-payment usa o mesmo engine

**Arquivo:** `backend/src/routes/loans.ts` (rota `POST /:loanId/generate-payment`)

- Substituir o cálculo inline por `interestEngine.computeCharge(...)`, garantindo convergência (2.7) com o cron.
- Normalizar o acesso a settings: hoje usa `prisma.systemSettings` (alias via proxy) — manter, pois funciona, mas centralizar a leitura da taxa dentro do engine/resolver.

### Mudança 4 — Marca de pagamento de juros (flag aditiva)

**Arquivo:** `backend/prisma/schema.prisma` (model `Installment`)
- Adicionar `isInterestPayment Boolean @default(false) @map("is_interest_payment")`.
- Semântica: marca o registro técnico de um **pagamento de juros (rolagem)** de CLT/GARANTIA, deixando claro que conceitualmente **não é uma parcela** nem uma amortização. Default `false` preserva o comportamento atual de qualquer registro existente.

**Arquivos:** rotas que geram o próximo registro de juros e que confirmam pagamento de juros:
- `paymentReceipts.ts /approve`, `loans.ts /manual-payment`, `collectionAutomationService.ts ensureInterestOnlyOpenInstallments`: ao **criar** o registro de juros de rolagem, setar `isInterestPayment: true`.
- Ao **confirmar** pagamento de juros (CLT/GARANTIA), além do já feito (não abater principal), garantir a marca no registro pago. A quitação permanece exclusiva de confirmação do admin (preservar fluxo `isDischarge`/aprovação).

> **Papel da flag (backend vs frontend).** No **backend**, `isInterestPayment` é a fonte de verdade que: (a) impede o abatimento da dívida ao confirmar pagamento de juros (rolagem não amortiza); (b) exclui esses registros dos **relatórios** de parcelas pagas; (c) impede que disparem o gatilho de **comissão** 40/30/30 (Mudança 7). No **frontend**, a decisão de **exibição** é tomada por `profileType` (Mudança 6) — MOTO mostra parcelas; CLT/GARANTIA mostram dívida + estado do juros; AUTONOMO mostra saldo — usando a flag apenas como insumo auxiliar (ex.: contagem de amortizadoras em MOTO).

### Mudança 5 — Ponto residual finance.ts

**Arquivo:** `backend/src/routes/finance.ts` (rota `PUT /receipts/:id/approve`)
- Antes de marcar `status='PAID'`, resolver `profileType` do loan da parcela e aplicar a mesma lógica de rolagem (não abater principal; marcar `isInterestPayment` quando aplicável). Comportamento falha-segura: se `profileType` indeterminado, não abater (2.11).

### Mudança 6 — Exibição por modalidade no frontend (decisão por `profileType`)

> **Princípio:** no frontend, a decisão do que exibir na coluna hoje rotulada "Parcelas" é tomada **por `profileType`**, não por uma simples contagem global. A flag `isInterestPayment` (Mudança 4) é a fonte de verdade **no backend** (para não abater dívida e para relatórios/comissões); no **frontend** ela é um insumo auxiliar, mas a regra de apresentação é orientada à modalidade. O `profileType` já é lido no frontend via `c.loanRequest?.profileType`, com fallbacks `isService`/`isInvestment` (validado em `pages/admin/Contracts.tsx`).

**Regra de exibição por modalidade (coluna "Parcelas" da tela de Contratos e equivalentes):**

| Modalidade | O que exibir | O que NÃO exibir |
|------------|--------------|------------------|
| **MOTO** | "X/Y parcelas pagas" (única com parcelas reais), onde `X = parcelas amortizadoras pagas`. | — |
| **CLT / GARANTIA / GARANTIA_VEICULO** | **Saldo devedor** (`remainingAmount`) + **estado do juros do mês** (em dia / em aberto / atrasado). | **Nunca** "N/N pagas" — modalidade sem parcela. |
| **AUTONOMO** | **Saldo amortizado pelas diárias** (`remainingAmount` restante; opcionalmente progresso das diárias). | Contagem de "parcelas de prestação". |
| **LIMPA_NOME / INVESTIDOR** | Mantém comportamento atual (fora do escopo de cobrança). | — |

**Arquivos (árvore da raiz):**
- `pages/admin/Contracts.tsx`: a coluna "Parcelas" (linhas ~624 e o painel de detalhes ~783) passa a renderizar condicionalmente **por `profileType`** (a tela já possui `getProfileBadge`/`modalityFilter` lendo `c.loanRequest?.profileType`, então o dado está disponível). Apenas MOTO exibe `{paid}/{total} pagas`; CLT/GARANTIA exibem saldo + estado do juros; AUTONOMO exibe saldo. Onde a contagem de amortizadoras for usada (MOTO), `paidCount` filtra `i.status === 'PAID' && !i.isInterestPayment`.
- `services/reportService.ts`: o campo `paidInstallments` (`${paidCount}/${l.installmentsCount}`) passa a ser preenchido **somente para MOTO**; para CLT/GARANTIA o relatório exibe saldo devedor + estado do juros (sem contagem), e para AUTONOMO o saldo. O `paidCount`, quando calculado, exclui `isInterestPayment`.
- `pages/admin/Customers.tsx`: idem, se exibir contagem de parcelas por contrato.
- Painel do cliente (`pages/client/Contracts.tsx`, `pages/client/ClientDashboard.tsx`): aplicar a mesma decisão por `profileType` no rótulo hoje genérico ("Cobranças"/lista de parcelas). MOTO mantém contagem de parcelas; CLT/GARANTIA mostram saldo + estado do juros; AUTONOMO mostra saldo.
- Invariante de UI transversal: **nunca** exibir `paid == total` enquanto `remainingAmount > 0` (req. 2.10); e **nunca** exibir contagem de parcelas para CLT/GARANTIA (req. 2.10).
- `types.ts` (raiz): adicionar `isInterestPayment?: boolean` à interface de `Installment` (opcional, backward-compatible). O `profileType` já trafega via `loanRequest?.profileType`.

### Mudança 7 — Gatilho de comissão conta só amortizadoras

**Arquivo:** `backend/src/routes/loans.ts` (bloco de comissão em `/proof`) e `cron/installmentReminders.ts` (avaliação de inadimplência).
- `prisma.installment.count({ where: { loanId, status: 'PAID', isInterestPayment: false } })` (3.6).

## Testing Strategy

### Validation Approach

Abordagem em duas fases. Primeiro, expor contraexemplos que demonstrem o bug no código **não corrigido** (cálculo 10% e contagem de juros como paga). Depois, verificar que o fix produz a fórmula oficial e preserva o comportamento de amortização/serviços/investimentos. O alvo principal de teste é a função pura `interestEngine.computeCharge` e as funções puras de derivação de `paidCount`, que isolam a lógica sem I/O.

**Framework recomendado:** `fast-check` (property-based) executado por `vitest` em ambiente Node/TS no backend. Justificativa: o backend usa TypeScript + `tsx`; `vitest` integra nativamente com TS sem config extra e roda funções puras sem subir Express/Prisma. Instalar como devDependencies do backend: `fast-check`, `vitest`. Rodar sempre em modo único (`vitest --run`), nunca em watch.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples que demonstram o bug ANTES de implementar o fix. Confirmar ou refutar a análise de causa-raiz. Se refutarmos, re-hipotetizar.

**Test Plan**: Escrever testes que chamam o cálculo atual (`calculateOverdueAmount`) e a contagem atual de `paidCount`, comparando com a fórmula oficial. Rodar contra o código NÃO corrigido para observar as falhas.

**Test Cases**:
1. **CLT em atraso (cálculo)**: principal 1000, loanAmount 1000, D=6 → atual R$ 306,00 vs oficial R$ 490,00 (falha no código atual).
2. **AUTONOMO em atraso (cálculo)**: aplica 10% igual a CLT, ignorando exclusão de domingo e ausência de 7% (falha no código atual).
3. **Convergência cron vs generate-payment**: mesma entrada → valores diferentes (falha no código atual).
4. **Pagamento de juros conta como paga**: marcar parcela de juros PAID → `paidCount` incrementa e pode atingir `total` com `remainingAmount > 0` (falha no código atual).
5. **Edge — D=0 CLT**: garantir que não aplica 7%/R$20 (verificar fronteira).
6. **finance.ts /approve**: aprova recibo de parcela de juros → marca PAID sem checar profileType (falha no código atual).

**Expected Counterexamples**:
- `valor_com_juros` calculado ≠ fórmula oficial para CLT/AUTONOMO em atraso.
- `paidCount == totalInstallments` com `remainingAmount > 0` em contrato CLT/GARANTIA.
- Possíveis causas: 10% hardcoded; ausência de 7% e de soma da multa diária ao valor; ausência de marca `isInterestPayment`.

### Fix Checking

**Goal**: Verificar que para todas as entradas onde a bug condition se verifica, a função corrigida produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := interestEngine.computeCharge(input)      // ramo CHARGE
  ASSERT result.total == officialCharge(input.profileType, input.principal,
                                        input.loanAmount, input.daysOverdue)
  ASSERT result.usedRate != 0.10
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todas as entradas onde a bug condition NÃO se verifica, a função corrigida produz o mesmo resultado da função original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // amortizadores e parcelas não vencidas
  ASSERT chargeOriginal(input)  == chargeFixed(input)        // D=0, MOTO, serviços
  ASSERT remainingAfterFixed(interestPayment) == remainingBefore   // rolagem não amortiza
  ASSERT displayForProfile(MOTO).count == paidCountOriginal(state_without_interest)
  ASSERT displayForProfile(CLT|GARANTIA).showsInstallmentCount == false  // mostra saldo + estado do juros
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservação porque gera muitos casos automaticamente no domínio de entradas, captura edge cases que testes manuais perdem e dá garantia forte de que o comportamento de amortização/serviço/investimento permanece inalterado.

**Test Plan**: Observar primeiro o comportamento no código NÃO corrigido para amortizadores (AUTONOMO/MOTO), D=0 e quitação total; então escrever propriedades que fixam esse comportamento e verificá-las após o fix.

**Test Cases**:
1. **Amortização AUTONOMO**: observar que pagar diária abate `remainingAmount`; verificar que continua após o fix.
2. **Parcela não vencida (D=0)**: observar valor original sem juros; verificar invariância.
3. **Quitação total**: observar marcação de tudo PAID e `remainingAmount=0`; verificar invariância.
4. **Serviço/Investimento**: observar ausência de juros de mora; verificar invariância.
5. **Exibição por modalidade**: estado com amortizadoras pagas + juros pagos → para MOTO, `paidCount` conta só amortizadoras e nunca atinge `total` com saldo > 0; para CLT/GARANTIA, a UI não renderiza contagem de parcelas (exibe saldo + estado do juros); para AUTONOMO, exibe saldo.

### Unit Tests

- `interestEngine.computeCharge`: CLT/GARANTIA com D>0, D=0; AUTONOMO com domingos no intervalo; MOTO; serviço/investimento.
- Resolução da cascata de taxa (contrato → customer → SystemSetting → 0.30).
- Derivação de `paidCount` (MOTO) excluindo `isInterestPayment`; e da decisão de exibição por `profileType` (MOTO→parcelas; CLT/GARANTIA→saldo+estado do juros; AUTONOMO→saldo).
- `finance.ts /approve`: rolagem não abate; amortizador abate.

### Property-Based Tests

- Property 1 (Fix): para `principal>0`, `loanAmount>0`, `D` em range, perfis CLT/GARANTIA/AUTONOMO → `total` == fórmula oficial; 7% independente de D; nunca 10%.
- Property 2 (Preservation): para qualquer pagamento de juros de rolagem, `remainingAmount` inalterado e invariante `NOT(paidCount==total AND remaining>0)`; a UI nunca renderiza contagem de parcelas para CLT/GARANTIA (decisão por `profileType`); para amortizadores (MOTO/AUTONOMO), resultado idêntico ao original.
- Convergência (2.7): `computeCharge` chamado nos dois caminhos retorna valor idêntico para a mesma entrada (propriedade metamórfica).

### Integration Tests

- Fluxo completo CLT: gera cobrança (cron e generate-payment), confirma pagamento de juros, valida `remainingAmount` mantido e nova parcela de juros criada com `isInterestPayment=true`.
- Fluxo AUTONOMO: amortização ao longo de várias diárias, incluindo domingo, validando exclusão de domingo nos juros e R$ 20/dia na multa.
- Troca de contexto/telas: admin Contracts e painel cliente exibem **por modalidade** — MOTO mostra "X/Y parcelas pagas" coerente com `remainingAmount`; CLT/GARANTIA mostram saldo devedor + estado do juros (sem contagem de parcelas); AUTONOMO mostra saldo amortizado.
- Comissão de parceiro: parcelas de juros não disparam liberação 40/30/30; só amortizadoras.

## Migração de Dados em Produção (Backfill Idempotente)

> **NÃO rodar automaticamente.** Script manual com `--dry-run` por padrão.

**Arquivo (novo):** `backend/scripts/backfill-interest-rollover.ts`

**Objetivo:** Restaurar contratos CLT/GARANTIA já corrompidos (parcela de juros marcada PAID e principal abatido antes das correções), como o caso Patricia (`remainingAmount` R$ 700 → R$ 1.000).

**Algoritmo (idempotente e reversível):**
1. `--dry-run` (default): apenas lista contratos candidatos e o que seria alterado; não escreve nada.
2. Critério de seleção: `Loan` com `profileType ∈ {CLT, GARANTIA, GARANTIA_VEICULO}`, `status` ativo, e `remainingAmount < principalAmount` (sinal de abatimento indevido de juros).
3. Para cada candidato:
   - Identificar parcelas de juros (valor ≈ `principalAmount × taxa`) marcadas PAID que abateram o principal.
   - Marcar `isInterestPayment = true` nessas parcelas (idempotente: só altera se `false`).
   - Recalcular `remainingAmount = principalAmount` (rolagem não amortiza) — apenas se ainda não corrigido.
   - Registrar antes/depois em log para auditoria/reversão.
4. Idempotência: rodar duas vezes não muda nada na segunda execução (guarda por `isInterestPayment` e por `remainingAmount == principalAmount`).
5. Reversibilidade: o log de backfill permite reverter (`--revert <runId>`) restaurando os valores anteriores.
6. Execução real só com flag explícita `--apply` e backup do banco prévio.

**Validação pós-backfill:** rodar relatório de contratos onde `paidCount == total AND remainingAmount > 0` deve retornar zero após o fix.

## Ordem Segura de Deploy e Rollback

Pipeline: backend na Oracle VM via SSH; frontend via commit/push GitHub → Vercel. **Todas as alterações na árvore da raiz** (ver "Escopo de Arquivos / Ambiente"); a cópia `tubaraoemprestimo-main/` não entra no pipeline.

**Ordem recomendada (backend antes do frontend):**
1. **Backup do banco** (snapshot/dump) — ponto de rollback de dados.
2. **Schema aditivo primeiro:** `npx prisma db push` adicionando apenas `isInterestPayment Boolean @default(false)`. Como é aditivo com default, é backward-compatible: o código antigo ignora a coluna. (Rollback: a coluna pode permanecer; nada quebra se o código for revertido.)
3. **Deploy backend:** `npm run build` → `pm2 restart all`. Inclui interestEngine, uso no cron e em generate-payment, marca de `isInterestPayment` na criação/confirmação de parcelas de juros, e correção de `finance.ts`.
   - Ponto de rollback: `git checkout <commit anterior>` + `npm run build` + `pm2 restart all`. A coluna nova permanece inerte.
4. **Backfill em dry-run:** rodar `backfill-interest-rollover.ts` sem `--apply`, revisar a lista de contratos afetados (validar caso Patricia).
5. **Backfill real:** após validação, `--apply`. Idempotente e reversível por log.
6. **Deploy frontend (Vercel):** commit/push (árvore da raiz) com a **exibição por `profileType`** (MOTO→"X/Y parcelas pagas"; CLT/GARANTIA→saldo + estado do juros; AUTONOMO→saldo) e o tipo `Installment` atualizado com `isInterestPayment?`. Como o backend já envia a flag e o `profileType` já trafega via `loanRequest`, o frontend novo decide a exibição corretamente; o frontend antigo simplesmente ignora o campo novo (sem quebra).
   - Ponto de rollback: revert do commit no GitHub → Vercel redeploy automático.

**Por que backend primeiro:** o frontend novo depende da flag `isInterestPayment` vinda do backend (para contagem de amortizadoras em MOTO e relatórios) e do `profileType` (já existente) para decidir a exibição. Se o frontend fosse antes, `isInterestPayment` viria `undefined` (degradação suave, não quebra), mas a ordem backend→backfill→frontend garante dados corretos antes da UI passar a confiar neles.

**Janela de segurança:** os crons rodam às 9h (cobrança) e 8h/9h (lembretes). Fazer o deploy fora desses horários para evitar disparo de cobrança durante a transição.

## Pontos a Decidir (com recomendação)

1. **Domingo na multa diária do AUTONOMO (R$ 20/dia):** os juros de mora excluem domingo (confirmado, 2.6). Para a **multa** de R$ 20/dia, o código atual (`applyDailyLateFees`, `installmentEngine.calculateLateFee`) usa **dias corridos** (inclusive domingo). **Recomendação:** manter dias corridos como default (preserva comportamento atual e a regra "R$ 20/dia acumulativo" do bugfix.md), mas tornar parametrizável via parâmetro `sundayPolicyForFine` no engine, default `'CORRIDO'`. Decisão final do negócio pode flipar para `'PULA_DOMINGO'` sem mudar código.
2. **7% por ciclo:** aplicada **uma vez a cada ciclo mensal** em que o juros não foi pago em dia — não uma única vez no contrato, nem por dia. O engine aplica `loanAmount × 0,07` uma vez quando `D>0` para o ciclo corrente. **Recomendação:** confirmada; o engine não multiplica o 7% por dias nem por número de ciclos acumulados numa mesma cobrança (cada ciclo é avaliado isoladamente).
