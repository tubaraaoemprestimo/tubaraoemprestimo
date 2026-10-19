# 11 — Revisão jurídica (PENDENTE, bloqueia a abertura da oferta)

O sistema impede ligar a oferta enquanto `legalTemplateStatus` não for `approved`, e não gera contrato enquanto isso. Pontos para o advogado:

1. **Juros em venda parcelada**: a Tubarão não é instituição financeira autorizada pelo Banco Central. Confirmar a forma jurídica (venda a prazo pela própria loja, correspondente bancário ou parceira financeira), os limites de juros e encargos aplicáveis e a obrigação de informar CET.
2. **Propriedade do aparelho**: definir se a propriedade passa na entrega (compra a prazo) ou se há reserva de domínio até a quitação. O sistema registra as duas datas separadas e não presume nenhuma.
3. **MDM em aparelho vendido**: as regras da Apple exigem liberar do Apple Business os aparelhos que a organização não possui ou controla. O sistema bloqueia qualquer comando depois da transferência e tem checklist de liberação.
4. **Proibição de coação**: o sistema **não** bloqueia, rastreia nem apaga aparelho por atraso, e recusa comandos com esse propósito. Manter assim; qualquer mudança exige novo parecer.
5. **CDC**: direito de arrependimento (venda fora da loja/online), garantia legal, informação clara de preço à vista e total, cobrança sem constrangimento.
6. **LGPD**: base legal para documentos, dados financeiros e identificadores do aparelho; prazo de retenção; dados enviados a provedores de IA (o sistema já não envia CPF, IMEI nem endereço).
7. **Cláusulas**: não copiar multas, perda do bem ou garantia das modalidades Moto/Garantia.

Depois do parecer: preencher o texto do contrato (versão `phone-v1`), marcar o status jurídico como aprovado em Admin → Financiamento de Celulares → Configurações e só então ligar a oferta.
