# 03 — InfinitePay: reuso da integração existente

## Fluxo atual dos empréstimos (inalterado)

1. Cliente clica "Pagar" → `POST /api/payments/infinitepay/charges` → `infinitepayService.createChargeForCustomer` calcula o valor no servidor, cria `PaymentCharge` (id = `order_nsu`) e chama `POST /links` da InfinitePay.
2. InfinitePay chama `POST /api/webhooks/infinitepay`.
3. O serviço confirma com `POST /payment_check` (o webhook não tem assinatura), compara o valor, faz "claim" atômico e grava `transaction_nsu` UNIQUE.
4. Baixa via `applyApprovedPayment` (mesmo caminho da aprovação manual de comprovante).

## Celulares sobre a mesma infraestrutura

- Mesma conta (`INFINITEPAY_HANDLE`), mesmo cliente HTTP (`infinitepayClient.ts`), mesmo webhook e mesma URL de retorno. Nada foi recriado nem trocado.
- `order_nsu` = `PH-<id>`. O webhook olha o prefixo: `PH-` vai para `phonePayments.processWebhook`; qualquer outro valor segue **exatamente** o código antigo. Os ids de `payment_charges` são UUID, então nunca começam com `PH-`.
- Tabela própria `phone_sale_payments` (`order_nsu` e `transaction_nsu` UNIQUE). Nada é gravado em `payment_charges`, `installments` ou `loans`.
- Mesmas proteções: valor recalculado no servidor, confirmação por `payment_check`, valor conferido, claim atômico, duplicidade e segunda transação alertam o admin.
- Diferença proposital: a baixa aloca **somente na parcela alvo**. Pagamento maior que o saldo, ou para parcela já quitada, vai para `NEEDS_REVIEW` e o admin é avisado. Não há quitação em lote.
- A tela de retorno pode consultar `GET /api/phone-financing/payments/:id`, que reconcilia com `payment_check` a cada 20 s no máximo.
- Baixa manual: comprovante obrigatório; acima de `manualPaymentSecondApprovalCents` exige um **segundo admin diferente**.

## Testes

- `infinitepay.test.ts` (32 testes antigos) continua passando.
- `phonePayments.test.ts`: roteamento por prefixo, reaproveitamento de link, permissão, baixa só da parcela alvo, webhook duplicado, valor divergente, `payment_check` "não pago", parcela já paga, quitação sem tocar MDM/titularidade, baixa manual com 2ª conferência, pagamento parcial, comprovante obrigatório.

## Pendente

- Teste com pagamento real (Pix ou cartão) em uma venda de celular de teste, depois de ligar `PHONE_FINANCING_PAYMENT_ENABLED`. Estorno/chargeback é tratado hoje como revisão manual (`REFUNDED` existe no modelo, mas não há integração de estorno automático).
