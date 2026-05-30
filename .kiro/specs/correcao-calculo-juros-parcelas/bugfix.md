# Bugfix Requirements Document — Correção do Cálculo de Juros e Marcação de Parcela como Paga

## Introduction

Sistema **Tubarão Empréstimos** (produção, criticidade ALTA) apresenta defeitos correlacionados no fluxo de cobrança e pagamento de parcelas em atraso, com impacto financeiro direto e risco regulatório. Esta correção foi revisada para refletir as **regras de negócio oficiais** da empresa, que definem taxa padrão de **30% ao mês** (não 10%) e regras de multa por atraso distintas por modalidade.

**CONCEITO CENTRAL (regra de negócio oficial):** o termo **"parcela" só existe no Financiamento de Motocicleta (`MOTO`)**. Nas demais modalidades de empréstimo **NÃO há parcelas** — existe a **DÍVIDA** (valor emprestado) e o **juros mensal de 30%**. Logo, contar e exibir "X/Y parcelas pagas" só faz sentido para `MOTO`. Para `CLT`/`GARANTIA` (rolagem de juros) o que importa é o **saldo devedor** (valor emprestado que permanece) e o **estado do juros do mês**; para `AUTONOMO` o que importa é o **saldo sendo amortizado pelas diárias**.

Modalidades oficiais de contrato (campo `LoanRequest.profileType` / `Loan` flags):

| profileType | Modalidade | Juros | Modelo de dívida | Tem "parcela"? | Classificação |
|-------------|-----------|-------|------------------|----------------|---------------|
| `CLT` | Empréstimo CLT (Assalariado) | 30% a.m. | Dívida + juros (rolagem): principal não amortiza | **NÃO** — só dívida + juros | Empréstimo (`isLoan`) |
| `GARANTIA` | Empréstimo com Garantia | 30% a.m. | Dívida + juros (rolagem): principal não amortiza (idêntico a CLT) | **NÃO** — só dívida + juros | Empréstimo (`isLoan`) |
| `AUTONOMO` | Autônomo/Comerciante (Capital de Giro) | 30% a.m. | Dívida (valor + 30%) amortizada em **30 diárias** | **NÃO** — diárias amortizam o saldo (não é parcela de prestação) | Empréstimo (`isLoan`) |
| `MOTO` | Financiamento de Motocicleta | parcela fixa | Entrada + 36 parcelas + seguro, amortização | **SIM** — único caso com parcelas reais | Empréstimo (`isLoan`) |
| `LIMPA_NOME` | Limpa Nome | — | Serviço, sem juros de mora de empréstimo | N/A (serviço) | Serviço (`isService`) |
| `INVESTIDOR` | Área do Investidor | — | Remuneração ao investidor, não cobrança | N/A (investimento) | Investimento (`isInvestment`) |

Regras de cobrança por modalidade (esclarecidas oficialmente):

- **CLT e GARANTIA (dívida + juros, rolagem — sem parcelas)**: a dívida total é o **valor emprestado + 30%** (ex.: emprestou R$ 1.000,00 → dívida total R$ 1.300,00). O cliente paga **30% ao mês de juros** sobre o valor emprestado, cobrados SEMPRE. Se paga **somente o juros** (R$ 300,00): a dívida **continua integral** (o principal de R$ 1.000,00 permanece) e **rola** para o mês seguinte, cobrando novamente os mesmos 30% (R$ 300,00). Se paga **juros + valor total** (R$ 1.300,00): a dívida é **eliminada/quitada**. A **baixa/quitação só ocorre com confirmação do admin** — nada quita automaticamente. A multa por atraso incide quando o cliente **atrasa o pagamento do juros mensal** (passou do vencimento sem pagar os R$ 300,00) e é composta por **7% sobre o valor emprestado** (`Loan.amount × 0,07`, ex.: R$ 70,00), aplicada uma vez por ciclo de atraso, **mais R$ 20,00 por dia de atraso acumulativo** (dias corridos). GARANTIA é **idêntico** ao CLT; o bem em garantia (em posse da empresa, valendo no mínimo o dobro) **não altera** o cálculo de juros/multa nem o modelo de dívida.

- **AUTONOMO/COMERCIANTE (dívida amortizada em 30 diárias — sem parcelas de prestação)**: a dívida total é o **valor emprestado + 30%**, cobrada em **30 diárias** (ex.: R$ 1.300,00 / 30 ≈ R$ 43,33/dia). Cada diária paga **abate o saldo total** até zerar (amortização). Cobrança de segunda a sábado (feriados inclusos); **domingo não tem cobrança e não cobra juros**. A multa por atraso é de **R$ 20,00 por dia de atraso acumulativo**, SEM os 7% de inadimplência. A **baixa/quitação é confirmada pelo admin**.

- **MOTO (único com parcelas reais)**: financiamento com **entrada de R$ 2.000,00 (não reembolsável) + 36 parcelas mensais de R$ 611,00 + seguro de R$ 150,00/mês** (total R$ 761,00/mês). Cada parcela paga **reduz o saldo** (amortização). A contagem "X/Y parcelas pagas" **só é válida nesta modalidade**.

Os defeitos formalizados nesta correção são:

1. **Cálculo de juros incorreto e taxa errada nas mensagens de cobrança** (WhatsApp/Email): a função `calculateOverdueAmount()` em `services/collectionAutomationService.ts` usa taxa hardcoded de **10% ao mês** com prorrateio linear por dia de atraso, ignorando a taxa real de negócio (30% a.m.), ignorando qualquer taxa cadastrada (`Customer.monthlyInterestRate`/`lateInterestMonthly` ou `SystemSetting("monthlyInterestRate")`, hoje usada apenas na rota de geração de cobrança sob demanda em `routes/loans.ts`) e ignorando completamente as multas por atraso previstas no contrato (R$ 20,00/dia acumulativo e, para CLT/Garantia, 7% de inadimplência sobre o valor emprestado, disparada ao atrasar o pagamento do juros mensal). Caso real observado: cliente [name], parcela R$ 300,00, 6 dias de atraso, mensagem informa "Valor com juros: R$ 306,00" (300 × (1 + 0,10 × 6/30) = 306) — quando a taxa correta de negócio é 30% a.m.

2. **Inconsistência entre os dois caminhos de cálculo de juros**: a rota `POST /api/loans/:loanId/generate-payment` (em `routes/loans.ts`) já resolve a taxa a partir de `SystemSetting("monthlyInterestRate")` com fallback `'30'` (30%), enquanto o cron de cobrança usa 10% fixo. O mesmo contrato pode receber valores divergentes dependendo do caminho que disparou a mensagem.

3. **Exibição indevida de "parcelas pagas" para modalidades sem conceito de parcela (CLT/GARANTIA) e marcação indevida de pagamento de juros**: como "parcela" só existe em `MOTO`, exibir "X/Y parcelas pagas" para `CLT`/`GARANTIA` é **conceitualmente errado** — essas modalidades têm dívida + juros (rolagem), não parcelas. Hoje, porém, o pagamento mensal de juros (rolagem) é registrado como uma "parcela" marcada `PAID` em todas as rotas de confirmação de pagamento (`PUT /api/payment-receipts/:id/approve`, `PUT /api/loans/:loanId/installments/:installmentId/proof`, `PUT /api/finance/receipts/:id/approve`), e o frontend (`services/reportService.ts`) conta essas marcações e exibe contagem de "parcelas pagas" (ex.: "1/1 pagas" no contrato CLT da cliente [name]) para um contrato que **não possui parcelas**. Isso quebra a regra "rolagem de juros não quita dívida e não amortiza o principal", e a baixa/quitação — que só deveria ocorrer por **confirmação do admin** — fica indistinguível de uma rolagem de juros. A UI deveria, nessas modalidades, exibir o **saldo devedor** (valor emprestado que permanece) e o **estado do juros do mês** (em dia / em aberto / atrasado), e não uma contagem de parcelas.

Esta correção formaliza a regra de negócio oficial, deixa explícito que **"parcela" só existe em `MOTO`**, padroniza o cálculo de juros/multa de atraso a partir da taxa de 30% a.m. e das multas por modalidade, diferencia o tratamento de pagamento entre contratos de **dívida + juros / rolagem** (CLT, Garantia), de **amortização por diárias** (Autônomo) e de **parcelas** (Moto), e corrige a exibição na UI para que CLT/Garantia mostrem **saldo devedor + estado do juros do mês** em vez de contagem de parcelas. A baixa/quitação permanece exclusivamente sob **confirmação do admin** (nada automático), sem regredir os fluxos de amortização hoje funcionais.

## Bug Analysis

### Current Behavior (Defect)

Comportamento atual observado no sistema em produção:

1.1 WHEN uma parcela de R$ X está em atraso por D dias e o cron de cobrança dispara o template `INSTALLMENT_OVERDUE_7_DAYS`/`_15_DAYS`/`_30_DAYS` THEN o sistema calcula e envia ao cliente `valor_com_juros = X × (1 + 0,10 × D/30)` usando a taxa hardcoded de **10% ao mês** em `calculateOverdueAmount()`, valor que não corresponde à taxa real de negócio (30% a.m.) nem a qualquer taxa cadastrada em `Customer.monthlyInterestRate`/`lateInterestMonthly` ou em `SystemSetting(key="monthlyInterestRate")`.

1.2 WHEN o cenário 1.1 ocorre THEN o sistema NÃO inclui no `valor_com_juros` a multa fixa diária de R$ 20,00 por dia de atraso (acumulativa) prevista no contrato, porque essa multa não é calculada nem persistida em nenhum campo (não existem colunas `fineAccumulated`/`lateFeeAmount`/`daysOverdue` em `Installment`, nem rotina de aplicação diária de multa no backend).

1.3 WHEN o cenário 1.1 ocorre para um contrato CLT ou Garantia em que o cliente atrasou o pagamento do juros mensal THEN o sistema NÃO inclui a multa de inadimplência de 7% sobre o valor emprestado (`Loan.amount × 0,07`), porque essa multa não é calculada nem armazenada (não há campo de multa percentual em `Loan`/`Installment`; `Customer.lateFixedFee` é uma taxa fixa genérica, não os 7% por modalidade).

1.4 WHEN a mensagem de cobrança é montada THEN o sistema aplica o mesmo cálculo de juros para todas as modalidades, sem diferenciar que Autônomo (capital de giro) tem apenas multa de R$ 20/dia acumulativo enquanto CLT/Garantia têm 7% sobre o valor emprestado + R$ 20/dia acumulativo.

1.5 WHEN existe a rota de geração de cobrança sob demanda `POST /api/loans/:loanId/generate-payment` (em `routes/loans.ts`) THEN ela resolve a taxa via `SystemSetting("monthlyInterestRate")` com fallback `'30'` (30%), divergindo do cron que usa 10% fixo, de modo que o mesmo contrato recebe valores diferentes conforme o caminho de disparo.

1.6 WHEN um pagamento de juros (rolagem) é aprovado em `PUT /api/payment-receipts/:id/approve` para um contrato de perfil CLT ou GARANTIA (modalidades **sem conceito de parcela**) THEN o sistema registra esse pagamento como uma "parcela" marcada `status = 'PAID'` e `paidAt = now()`, indistinguível de uma quitação real, e recalcula `remainingAmount = totalLoan − Σ(parcelas PAID)`, reduzindo o saldo devedor mesmo se tratando de rolagem (a dívida deveria permanecer integral).

1.7 WHEN um pagamento é registrado via `PUT /api/loans/:loanId/installments/:installmentId/proof` THEN o sistema sempre executa `remainingAmount = max(0, remainingAmount − installment.amount)` e marca `status = 'PAID'`, sem qualquer verificação de `profileType`, abatendo o juros do saldo devedor mesmo em contratos CLT/Garantia (rolagem).

1.8 WHEN o cenário 1.6 ou 1.7 ocorre em um contrato CLT/Garantia com valor emprestado R$ P e juros do mês R$ J THEN após confirmar o pagamento o `Loan.remainingAmount` passa a ser `P − J` (em vez de manter `P`), violando a regra de rolagem (a dívida só deveria ser eliminada quando o cliente paga juros + valor total, e somente com confirmação do admin).

1.9 WHEN o frontend lê os contratos (`services/reportService.ts`) THEN conta `paidCount = l.installments.filter(i => i.status === 'PAID').length` e exibe "N/N pagas" (ex.: "1/1 pagas" no contrato CLT/Garantia da cliente [name]) para uma modalidade que **não possui parcelas** (CLT/GARANTIA só têm dívida + juros), ainda por cima com `remainingAmount > 0`, gerando uma informação conceitualmente incorreta na tela. O correto seria não exibir contagem de parcelas para essas modalidades.

### Expected Behavior (Correct)

Comportamento que o sistema DEVE apresentar após a correção, conforme as regras de negócio oficiais:

2.1 WHEN uma parcela está em atraso por `D` dias e qualquer template de cobrança (`INSTALLMENT_OVERDUE_*`) é disparado THEN o sistema SHALL calcular o juros usando a taxa de juros efetiva de **30% ao mês** resolvida pela cascata de prioridade: (a) taxa do contrato, quando vier a existir um campo de taxa por contrato; senão (b) `Customer.monthlyInterestRate` (ou `Customer.lateInterestMonthly` para juros de mora); senão (c) `SystemSetting(key="monthlyInterestRate")`; senão (d) fallback documentado de **30% ao mês** (NÃO 10%).

2.2 WHEN a parcela em atraso pertence a um contrato de perfil CLT ou GARANTIA (rolagem de juros) e o cliente atrasou o pagamento do juros mensal THEN o sistema SHALL compor o `valor_com_juros` exibido na cobrança como `juros_do_mês + multa_7% + multa_diária`, onde:
- `juros_do_mês = principal × 0,30` (ex.: R$ 1.000,00 × 0,30 = R$ 300,00);
- `multa_7% = Loan.amount × 0,07` (ex.: R$ 1.000,00 × 0,07 = R$ 70,00), aplicada **uma única vez por ciclo de atraso**;
- `multa_diária = D × R$ 20,00` (acumulativa, em dias corridos).
Ou seja, `valor_com_juros = (principal × 0,30) + (Loan.amount × 0,07) + (D × 20)`.

2.3 WHEN a parcela (juros mensal) de um contrato CLT ou GARANTIA **ainda não venceu** (não há atraso, `D = 0`) THEN o sistema SHALL exibir na mensagem apenas o valor do juros mensal (`principal × 0,30`), SEM a multa de 7% e SEM a multa diária de R$ 20.

2.4 WHEN a multa de inadimplência de 7% é aplicada a um contrato CLT ou GARANTIA THEN o sistema SHALL calculá-la sobre o **valor emprestado** (`Loan.amount × 0,07`), aplicada **uma vez por ciclo de atraso** (e não por dia), disparada exclusivamente pelo atraso no pagamento do juros mensal — não exigindo inadimplência no principal.

2.5 WHEN a parcela em atraso pertence a um contrato de perfil AUTONOMO (capital de giro / 30 diárias) THEN o sistema SHALL aplicar apenas a multa de **R$ 20,00 por dia de atraso (acumulativa)**, SEM a multa de 7% de inadimplência, somada ao juros de mora calculado à taxa de 30% a.m.

2.6 WHEN o juros de mora de um contrato AUTONOMO é calculado THEN o sistema SHALL **excluir os domingos da contagem de juros** ("no domingo não cobra juros"), pois a cobrança ocorre de segunda a sábado (feriados inclusos). NOTA: para a multa diária de R$ 20,00, a regra de negócio trata os dias como dias corridos (acumulativo); o tratamento de domingo especificamente para a multa diária PRECISA DE CONFIRMAÇÃO caso o código atual exija distinguir entre dias corridos e dias úteis na contagem da multa.

2.7 WHEN tanto o cron de cobrança quanto a rota `POST /api/loans/:loanId/generate-payment` calculam o valor com juros para o mesmo contrato e período THEN o sistema SHALL produzir o mesmo resultado, usando uma única função/fonte de taxa compartilhada (eliminando a divergência 10% vs 30%) e aplicando as mesmas regras de multa por modalidade.

2.8 WHEN um pagamento de juros é confirmado em qualquer rota (`PUT /api/payment-receipts/:id/approve`, `PUT /api/loans/:loanId/installments/:installmentId/proof`, `PUT /api/finance/receipts/:id/approve`) para um contrato de perfil CLT ou GARANTIA (modalidades **sem conceito de parcela**) THEN o sistema SHALL registrar o pagamento de juros (com `paidAt` e `proofUrl` preenchidos) usando um tratamento distinto de quitação, de forma que esse pagamento NÃO seja contabilizado como parcela amortizadora quitada nem reduza a dívida.

2.9 WHEN o cenário 2.8 ocorre THEN o sistema SHALL manter `Loan.remainingAmount` inalterado (`remainingAmount_after = remainingAmount_before`), preservando o valor emprestado integral (rolagem de juros não amortiza), de modo que a mesma dívida volte a gerar 30% no próximo ciclo. A dívida só SHALL ser eliminada quando o cliente paga juros + valor total e, em todo caso, a baixa/quitação SHALL ocorrer **exclusivamente por confirmação do admin** (nunca automaticamente).

2.10 WHEN o frontend exibe um contrato de perfil CLT ou GARANTIA THEN o sistema SHALL NÃO exibir contagem de parcelas ("X/Y pagas"), pois essas modalidades não possuem parcelas; em vez disso SHALL exibir o **estado da dívida**: o **saldo devedor** (valor emprestado que permanece) e o **estado do juros do mês** (em dia / em aberto / atrasado). A UI nunca SHALL apresentar "N/N pagas" para CLT/GARANTIA.

2.11 WHEN o frontend exibe um contrato de perfil AUTONOMO THEN o sistema SHALL exibir o **saldo sendo amortizado pelas diárias** (saldo devedor restante; opcionalmente o progresso das diárias), e não uma contagem de "parcelas de prestação".

2.12 WHEN o frontend exibe um contrato de perfil MOTO THEN o sistema SHALL CONTINUE TO exibir "X/Y parcelas pagas", por ser a **única modalidade com parcelas reais**.

2.13 WHEN o `profileType` não está disponível no momento de processar um pagamento de um contrato `isLoan` THEN o sistema SHALL resolver o `profileType` de forma resiliente (consultando `LoanRequest`) e, na dúvida, adotar comportamento falha-segura que NÃO abate o saldo devedor indevidamente.

2.14 WHEN um pagamento é confirmado para um contrato de perfil AUTONOMO (diária amortizadora) ou MOTO (parcela) THEN o sistema SHALL abater o saldo devedor normalmente (comportamento de amortização preservado, ver seção 3), mantendo a baixa/quitação final sob confirmação do admin.

### Unchanged Behavior (Regression Prevention)

Comportamentos atuais que devem ser preservados sem qualquer alteração:

3.1 WHEN um pagamento amortizador de contrato AUTONOMO (diária) ou MOTO (parcela) é confirmado em qualquer rota de pagamento THEN o sistema SHALL CONTINUE TO marcar o pagamento como `status = 'PAID'`, abater `remainingAmount = max(0, totalLoan − Σ pagamentos PAID amortizadores)` (ou `max(0, remainingAmount − amount)` na rota de proof) e marcar `Loan.status = 'PAID'` quando `remainingAmount` chegar a zero, sob confirmação do admin.

3.2 WHEN uma parcela não está em atraso (`daysOverdue = 0`) e o cron de lembretes (`INSTALLMENT_DUE_*`/vencimento) é disparado THEN o sistema SHALL CONTINUE TO enviar a mensagem com o valor original da parcela, sem aplicar juros nem multa.

3.3 WHEN um cliente possui `Customer.monthlyInterestRate`/`lateInterestMonthly`/`lateInterestDaily`/`lateFixedFee` cadastradas individualmente THEN o sistema SHALL CONTINUE TO permitir que essas taxas sejam editadas via `PUT /api/customers/:id/rates` e que sejam usadas no cálculo conforme a cascata de prioridade definida em 2.1.

3.4 WHEN um contrato é `LIMPA_NOME` (`isService = true`) THEN o sistema SHALL CONTINUE TO tratá-lo como serviço de contestação administrativa, fora do escopo de cálculo de juros de mora e multa de empréstimo (não aplica 30% a.m., 7% nem R$ 20/dia).

3.5 WHEN um contrato é `INVESTIDOR` (`isInvestment = true`) THEN o sistema SHALL CONTINUE TO tratá-lo como remuneração ao investidor (2,5%/mês de R$ 10k–49.999; 5%/mês a partir de R$ 50k), fora do escopo do cálculo de juros de mora de cobrança.

3.6 WHEN um pagamento é confirmado e o `LoanRequest` é uma indicação de parceiro (`isPartnerReferral = true`) THEN o sistema SHALL CONTINUE TO disparar o gatilho de liberação de comissão 40/30/30, contabilizando apenas parcelas efetivamente amortizadoras pagas (não os pagamentos de juros de rolagem).

3.7 WHEN `Loan.remainingAmount` é exibido no frontend (admin Contracts/Customers, painel cliente Dashboard/Contracts, dashboards financeiros) THEN o sistema SHALL CONTINUE TO ler o valor diretamente do backend sem recálculos no frontend.

3.8 WHEN uma quitação total de um contrato é confirmada THEN o sistema SHALL CONTINUE TO marcar as parcelas pendentes como `PAID`, zerar `remainingAmount` e marcar `Loan.status = 'PAID'`.

3.9 WHEN o financiamento de Motocicleta (`MOTO`) é processado THEN o sistema SHALL CONTINUE TO tratá-lo como amortização de **parcelas fixas** (entrada de R$ 2.000,00 não reembolsável + 36 parcelas de R$ 611,00 + seguro R$ 150,00/mês), com cada parcela paga reduzindo o saldo, sendo a **única modalidade** em que a contagem "X/Y parcelas pagas" é exibida.
