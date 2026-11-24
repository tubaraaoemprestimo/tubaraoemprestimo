# 05 — Validação financeira

**Nenhum valor, multa, taxa ou saldo foi alterado.** Todas as consultas abaixo foram somente leitura (SELECT) em 24/11/2026.

## Caso do vídeo (contrato `1ecf84ba…`, CLT, mensal)

| Campo | Banco | Origem do valor na tela |
|---|---|---|
| Principal | `loans.remaining_amount` = 500 | `getLoanPayoffBalance` → `principalBalance` |
| Taxa | `loans.interest_rate` = 30 (**% ao mês**, regra oficial do `interestEngine.ts`) | — |
| Juros R$ 600 | 4 cobranças de juros em aberto × R$ 150 | soma de `installments.amount` com `is_interest_payment` em aberto |
| Multas R$ 5.180 | `late_fee_amount` das 4 cobranças: 2.235 + 1.615 + 1.015 + 395 | soma de `late_fee_amount` em aberto |
| Total R$ 6.280 | 500 + 600 + 5.180 | `totalPayoffBalance` |
| 109/110 dias | maior `days_overdue` (parcela de 06/08/2026) | — |

### Divergências encontradas
1. **Juros de R$ 150 com taxa de 30%.** 30% de R$ 500 = R$ 150. Bate com a regra (30% a.m. sobre o principal).
2. **Multas sobrepostas.** A regra oficial (`interestEngine.computeCharge`) para CLT em atraso é: `7% do valor emprestado (uma vez) + R$ 20 × dias de atraso`. Aqui cada uma das 4 cobranças mensais acumula sua própria multa diária: o mesmo dia de atraso é cobrado até 4 vezes. Pela regra única: 7% × 500 + 110 × 20 = **R$ 2.235** (exatamente o valor da cobrança mais antiga), contra **R$ 5.180** exibidos.
   *Interpretação a confirmar pelo responsável:* se cada mês em atraso deve ter multa própria, os R$ 5.180 estão corretos. O código da regra fala em "uma vez".
3. **Comprovante de R$ 505** (22/06/2026) está ligado à parcela de 06/06, **já marcada como PAGA** em 21/07/2026. Ele continua "pendente". Aprovar hoje geraria crédito em dobro e, na rolagem CLT, uma parcela de juros extra. **Agora bloqueado** (409 `INSTALLMENT_ALREADY_PAID`).

## Alcance na carteira (dry-run, contratos ativos com multa em aberto)

| Modalidade | Contratos | Com multas sobrepostas | Multas hoje | Pela regra única (7% + R$20 × maior atraso) |
|---|---|---|---|---|
| CLT | 25 | 20 | R$ 172.065,00 | R$ 56.410,00 |
| AUTONOMO | 2 | 2 | R$ 176.740,00 | R$ 8.980,00 |

Os 2 AUTONOMO: contrato de R$ 1.000 com R$ 135.600 de multa (30 diárias de R$ 44, até 243 dias) e contrato de R$ 2.000 com R$ 41.140 (11 diárias de R$ 87).

- **53 de 57** comprovantes pendentes apontam para parcelas já pagas (o mais antigo é de 07/04/2026).

## Recomendação (requer autorização específica)
1. O responsável define a regra: multa diária **por contrato** (regra do `interestEngine`) ou **por cobrança** (comportamento atual do cron).
2. Se for por contrato: corrigir o cron de multas para não reaplicar sobre cobranças sobrepostas e, separadamente, decidir se os valores já lançados serão recalculados (com o relatório de antes/depois por contrato).
3. Revisar os 53 comprovantes "pendentes" de parcelas pagas: rejeitar em lote com motivo "parcela já quitada" ou registrar como pagamento avulso, caso a caso.

Nada disso foi executado.
