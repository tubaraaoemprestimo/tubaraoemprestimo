# Fase de conciliação e estabilização — 25/11/2026

Nenhum valor financeiro histórico foi alterado. Nenhuma migração. Nenhum comprovante rejeitado ou excluído.
Todas as leituras de produção foram SELECT (ou Prisma com bloqueio de escrita).

## 1. Estado da produção (antes desta fase)
GitHub/Vercel `f2d4052` · backend Oracle `1adfe8b` · PM2 `tubarao-backend` online (15 restarts, 0 instáveis) · health 200 · PostgreSQL ok.
Logs: 3 erros `S3ServiceException InternalError` no upload (erro do lado do armazenamento R2, transitório; não relacionado a esta manutenção).

## 2. Regra de juros do AUTONOMO

| | Onde | Quando |
|---|---|---|
| **Spec** (30% a.m. de mora pró-rata, exclui domingos, + R$20/dia, sem 7%) | `.kiro/specs/correcao-calculo-juros-parcelas/bugfix.md` 2.5/2.6; motor em `be9079c` | 29/05/2026 |
| **Código atual** (diária + R$20 × dias corridos; sem mora, sem domingo) | `interestEngine.ts` (`cd25764`) e `collectionAutomationService.applyDailyLateFees` (`32edcf2`, 28/03) | 02/06/2026 |

- Contratos AUTONOMO: **2 ativos** (saldo R$ 1.173,00, iniciados em mar–abr/2026) e 3 quitados. Todos são anteriores à spec; o contrato padrão diz só "juros de mora e multa conforme tabela vigente" (`documentService.ts`), sem fixar a fórmula.
- Feriados: nenhuma das regras trata feriados. Pagamento parcial: waterfall multa → principal (`applyPaymentWaterfall`), igual nas duas regras. Renegociação: não existe fluxo de renegociação no código (só texto em e-mail).

**Comparativo (valores fictícios — diária R$ 43,33 de um contrato de R$ 1.000):**

| Atraso | Atual | Juros de mora (spec) | Spec, multa em dias corridos | Spec, multa sem domingo | Diferença (spec − atual) |
|---|---|---|---|---|---|
| em dia | 43,33 | 0,00 | 43,33 | 43,33 | 0,00 |
| 1 dia | 63,33 | 10,00 | 73,33 | 73,33 | +10,00 |
| 7 dias (1 domingo) | 183,33 | 60,00 | 243,33 | 223,33 | +60,00 |
| 30 dias (4 domingos) | 643,33 | 260,00 | 903,33 | 823,33 | +260,00 |
| 110 dias | 2.243,33 | 950,00 | 3.193,33 | 2.893,33 | +950,00 |

**Os 5 testes:** falham porque testam a spec; o código implementa a regra de 02/06. É **divergência de negócio**, não falha técnica. Provado: mesmas 5 falhas na versão anterior à manutenção; nenhum deles foi alterado.

**Arquitetura proposta (não executada):** gravar a regra no contrato no momento da contratação — coluna `loans.late_fee_rule` (`'AUTONOMO_V1_DIARIA_20'`, `'AUTONOMO_V2_MORA30_SEM_DOMINGO'`…), com default igual à regra atual. O motor escolhe a fórmula pela regra gravada; contratos existentes ficam na regra de hoje. Migração aditiva (`ADD COLUMN ... DEFAULT`), reversível. **Depende de autorização.**

## 3. Rotina de multas das 9h
- `collectionCron.ts`: `node-cron` `0 9 * * *`, fuso `America/Sao_Paulo`. Antes: trava só em memória (`isRunning`).
- `applyDailyLateFees` **recalcula** e grava o valor absoluto (`7% + R$20 × dias` nos mensais; `R$20 × dias` nos diários). Rodar duas vezes no mesmo dia **não dobra** a multa (teste novo). Contratos quitados/cancelados não entram (`loan.status = ACTIVE`). Parcelas pagas não entram.
- **Risco técnico corrigido:** a régua também envia mensagens e cria parcelas de juros; com mais de um processo (PM2 em cluster, segunda instância, execução manual) duas rodadas simultâneas podiam enviar cobranças em dobro. Agora há trava no PostgreSQL entre processos (`pg_try_advisory_xact_lock`), verificada em banco descartável: 2 processos simultâneos → 1 executa, 1 pula; trava liberada ao final.
- **Falha de permissão corrigida:** `POST /api/collection-automation/run` (dispara a régua inteira: mensagens, juros e multas) aceitava **qualquer usuário logado, inclusive cliente**. Agora só admin (também stats/history/templates).
- **Sobreposição (decisão de negócio, não bug técnico):** cada cobrança mensal em aberto tem sua própria multa (7% + R$20/dia). Em quem atrasa vários meses, o mesmo dia é cobrado várias vezes.

| Modalidade | Contratos com multa | Com sobreposição | Parcelas | Multa hoje | Uma multa por contrato | Diferença |
|---|---|---|---|---|---|---|
| CLT | 23 | 20 | 101 | R$ 171.545,00 | R$ 55.890,00 | R$ 115.655,00 |
| AUTONOMO | 2 | 2 | 41 | R$ 176.740,00 | R$ 8.980,00 | R$ 167.760,00 |

Não é geração contínua indevida pelo código (o código faz exatamente a regra "por cobrança"); é a regra que precisa ser confirmada. Nada recalculado.

## 4. Conciliação dos 53 comprovantes (somente leitura)
Classificação individual em `53-comprovantes.md`, gerada pelo próprio código e conferida por SQL independente.

| Classe | Qtd | Significado |
|---|---|---|
| Já conciliado | 16 | parcela já tem comprovante aprovado de mesmo valor |
| Possível duplicidade | 12 | mesmo valor reenviado no mesmo dia para a mesma parcela |
| Pagamento excedente | 1 | parcela paga e valor maior que a parcela |
| Divergência de valor | 2 | valor maior que a parcela, sem aprovação registrada |
| Análise manual | 22 | 12 em parcelas de valor 0 (juros antigos) + 10 sem aprovação registrada |
| Parcial / divergência de contrato | 0 | — |

Área nova: **Central Financeira → aba Conciliação**: filtros por classe, cliente, contrato, valores, datas, motivo, ver comprovante, abrir contrato, "rejeitar com motivo" individual (não mexe em saldo/parcela) e lote **só** para "Já conciliado" e "Possível duplicidade", com confirmação. A rejeição usa a rota existente, que já grava quem/quando/motivo. **Nenhuma rejeição foi feita.**

## 5. Central do cliente
Funcionalidades anteriores preservadas (homologação de 24/11). Nada ampliado em localização, familiares ou contatos de terceiros. Documentos pessoais só para admin (`requireAdmin`).

## 6. Testes
- Backend: **148 aprovados, 5 reprovados** (os 5 da regra AUTONOMO). Novos: classificação (7), multas repetidas não duplicam (1), trava entre processos (1), permissões da automação e da conciliação (1).
- PostgreSQL descartável: trava do cron 2/2; baixa de pagamento 4/4 (fase anterior).
- Frontend: tsc e build ok.

## 7. Deploy e rollback
Ver o fim deste arquivo (preenchido após a implantação).
