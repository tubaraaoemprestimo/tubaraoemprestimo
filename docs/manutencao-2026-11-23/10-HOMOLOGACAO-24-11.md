# 10 — Homologação complementar (24/11/2026, tarde)

Branch: `manutencao/homologacao-2026-11-24` (a partir de `main` @ `b35abb6`). **Nada desta branch foi publicado ainda.**

## 1. Os 5 testes que falham — preexistentes, não regressão

| # | Arquivo › teste | Causa |
|---|---|---|
| 1 | `interestEngine.bug.test.ts` › Ramo A — AUTONOMO em atraso | Espera juros de mora 30% pró-rata excluindo domingos |
| 2 | `interestEngine.fix.test.ts` › AUTONOMO: total == base + jurosMora + D×20 | idem |
| 3 | `interestEngine.fix.test.ts` › AUTONOMO: domingos reduzem os dias de juros | idem |
| 4 | `interestEngine.fix.test.ts` › PULA_DOMINGO: multa == (D − domingos)×20 | Política de domingo removida do motor |
| 5 | `interestEngine.fix.test.ts` › property CORRIDO vs PULA_DOMINGO | idem |

- **Prova de que são antigas:** a mesma suíte rodada numa cópia isolada da versão anterior à manutenção (`148574e`) dá exatamente estas 5 falhas (132 aprovados / 5 reprovados). `interestEngine.ts` e esses testes não mudaram nesta manutenção (diff vazio).
- **Origem:** commit `cd25764` (02/06/2026, "fix: unifica valor de atraso no cliente") trocou a regra do AUTONOMO para `base + R$20 × dias`, sem juros de mora e sem exclusão de domingos, sem atualizar os testes nem a especificação (`.kiro/specs/correcao-calculo-juros-parcelas/bugfix.md` itens 2.5/2.6 ainda exigem mora 30% e domingos).
- **Impacto:** regra financeira em uso hoje = código (`cd25764`). Especificação e testes dizem outra coisa. **Não alterei a regra nem os testes** (seria mudar regra financeira só para o teste passar). Decisão do responsável: qual das duas vale.

**Total atual:** 139 aprovados, 5 reprovados (144). Os 7 testes de manutenção passam.

## 2. Defeito crítico encontrado e corrigido nesta rodada (não publicado)

**Comprovante podia ficar "APROVADO" sem a baixa ter sido feita.** Em `e38682a` (produção) o comprovante é marcado APPROVED e só depois `applyApprovedPayment` grava parcela/contrato/lançamento — em etapas separadas. Se a baixa falhar no meio, o comprovante fica aprovado, a baixa fica parcial, e uma nova tentativa recebe 409.
- **Produção:** nenhuma aprovação desde o deploy (consultado: 0 comprovantes revisados e 0 parcelas pagas após 24/11 13:44). Nenhum dado afetado.
- **Correção:** aprovação + baixa + lançamento numa única transação `Serializable` (`paymentReceipts.ts`, `paymentConfirmationService.ts`, `loanPayoffService.ts` aceita o cliente da transação). Notificações (e-mail/WhatsApp/push/recibo) só depois do commit. O webhook InfinitePay passa a ter a baixa em transação também (antes não tinha).
- **Regras financeiras:** inalteradas (mesmo código, só dentro da transação).

### Verificação contra PostgreSQL real e descartável
Container `postgres:15` temporário na VM, porta só em 127.0.0.1, banco `tubarao_paytest` com schema do Prisma e **só dados fictícios**; o script recusa rodar em outro banco. Removido ao final.

| Cenário | Resultado |
|---|---|
| Falha no meio da baixa desfaz parcela, contrato, lançamento e aprovação | PASSOU |
| Duas aprovações simultâneas aplicam uma vez (1 cobrança nova, 1 lançamento) | PASSOU |
| CLT: pagamento de juros mantém o principal (R$ 500) | PASSOU |
| AUTONOMO: R$ 150 paga R$ 40 de multa e abate R$ 110 (saldo R$ 390) | PASSOU |

Script: `backend/scripts/payment-integration-check.ts`.

## 3. Integridade de produção
- Backup das 03:00 restaurado num container isolado e comparado com produção: contratos (71), soma de saldos (R$ 29.099,40), valor contratado, parcelas (464/275 pagas), comprovantes (151/57 pendentes) **idênticos**.
- Única diferença: soma de `late_fee_amount` +R$ 2.950,00. Origem: cron diário de cobrança das 09:00 (`collectionCron`), código que esta manutenção **não alterou** (diff vazio em cron, cobrança, saldo e motor de juros). É o acúmulo normal (e o problema das multas sobrepostas já relatado em 05).
- Após o teste de integração: produção com os mesmos totais; 0 lançamentos novos.

## 4. Homologação visual (Chromium/Playwright, modo demo, dados fictícios, tráfego externo bloqueado)
Larguras 375, 390, 430, 768 e 1440. Resultado em `prints/homologacao/depois.json` e `antes.json`.

| Tela | Rolagem horizontal | Observação |
|---|---|---|
| Gestão de clientes | nenhuma em 5 larguras | antes: no 768 a tabela cortava as ações → agora cartões até 1024 px |
| Ficha completa (Histórico/central do cliente) | nenhuma | **antes: não abria em nenhuma largura** (botão só aparecia com solicitação) |
| Contratos → Detalhes → Ficha do cliente | nenhuma | o botão "Ficha do cliente" não existia antes |
| Editar contrato | nenhuma | — |
| Central financeira | nenhuma | — |
| Painel do cliente / contratos do cliente | nenhuma | — |
| Cliente tentando `/admin/customers` | — | redirecionado ao login (bloqueado) |

### Limitações (honestas)
- Só Chromium. Safari (WebKit) não está instalado nesta máquina; "iPhone" e "Android" = emulação de largura, não aparelho real.
- No modo demo, `/admin/contracts` e `/admin/finance` por URL direta mostram só a tela de abertura; navegando pelo menu carregam (prints `detalhes`, `editar`). A ficha no 390 foi capturada ainda carregando (dado do mock); no 768 e 1440 aparece completa.
- O modo demo de Contratos quebrava inteiro (preexistente, mock em formato errado). Corrigido no mock e com `fmt` tolerante a valor ausente.

## 5. Escopo que NÃO foi feito, de propósito
Não aprofundei atalhos de localização física de devedores (endereço/casa/família para abordagem presencial). O que já foi publicado (dados de contato, referências e documentos visíveis só ao admin) permanece; **recomendação:** confirmar com o jurídico o uso dos contatos de referência na cobrança (CDC art. 42 — cobrança sem exposição ou constrangimento; LGPD — finalidade e minimização), e registrar quem acessa a ficha.
