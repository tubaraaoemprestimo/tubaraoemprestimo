# 12 — Operação no dia a dia

## Admin → Financiamento de Celulares

1. **Configurações**: preencha juros ao mês, entrada mínima, prazo máximo, limite para 2ª conferência de baixa manual e condições comerciais. A oferta só liga com o status jurídico aprovado.
2. **Estoque**: cadastre produto → SKU (custo, preço à vista, preço financiado) → cada aparelho físico (serial, IMEI, nota fiscal). Para muitos aparelhos, use a importação CSV (`sku,serial,imei,imei2,invoice,supplier,location`), sempre com a simulação primeiro.
3. **Propostas**: analise → peça documentos ou aprove/recuse (recusa exige motivo) → reserve um aparelho (vale 72 h).
4. **Vendas**: crie a venda a partir da proposta aprovada (entrada, parcelas, 1º vencimento). O cronograma é gerado na hora.
5. **Entrega**: só depois da entrada paga. Registre quem recebeu e anexe o comprovante.
6. **Pagamentos**: o cliente paga pelo app (InfinitePay). Baixa manual exige comprovante; acima do limite, outro admin confirma.
7. **Cobrança**: lembrete antes do vencimento, aviso no dia, aviso após a tolerância e, uma semana depois, alerta para atendimento humano. Dá para pausar a cobrança de uma parcela (negociação).
8. **Transferência e liberação**: quando a propriedade passar ao cliente, registre a data. O aparelho sai do MDM e abre o checklist (remover MDM, liberar no Apple Business, Bloqueio de Ativação, restauração, termo). Cada passo exige evidência.

## Apple / MDM

Só para aparelhos da empresa (estoque, demonstração). Comando sensível (Modo Perdido, bloqueio de tela) exige propósito escrito e aprovação de outro admin. **Nunca** por atraso de pagamento: o sistema recusa.

## O que o sistema não faz

- Não bloqueia nem rastreia o celular do cliente.
- Não lê WhatsApp, fotos ou Apple ID.
- Não soma empréstimo com celular nos totais.
