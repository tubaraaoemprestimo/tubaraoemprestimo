# 12 — Conclusão das 7 pendências (25/11/2026)

**Commit em produção:** `8ba9dfa`, o mesmo no GitHub `main`, na Vercel (preview da branch com sucesso; produção com o bundle `index-Coiy4Fn2.js`) e no backend Oracle. O PM2 `tubarao-backend` está online (19 reinícios no total, 0 instáveis) e `/api/health` responde 200. Só o `tubarao-backend` foi reiniciado.

## Pendências

| # | Pendência | Solução | Principais arquivos | Evidência | Produção |
|---|---|---|---|---|---|
| 1 | Régua 7/5/3 | A régua existente já tinha os 3 avisos configuráveis. **D-5 habilitado** pelo painel às 14:40 (auditoria `COLLECTION_RULES_UPDATED`). Clientes antigos e atuais passam pela mesma rotina. Agora a régua também bloqueia em caso de contestação e de suspensão do cliente, e relê os dados do banco na hora do envio | `collectionRules.ts`, `collectionAutomationService.ts` | Programadas em produção: 4×D-7 e 3×D-5, nenhuma bloqueada. E2E: D-7/D-5/D-3 gerados, sem repetição, retomada sem acumulados | **Ativo: 7, 5 e 3 dias, 9h (Brasília)** |
| 2 | WhatsApp automático | Painel "Automações WhatsApp" (sem SSH): pausa geral, envio de convite/"regularizar" pelo sistema, **modo de teste** (só para um número de homologação) e histórico de enviadas/bloqueadas/falhas. Confirmação de pagamento, quitação e recusa de comprovante passam pelo mesmo controle; sem telefone confirmado, a mensagem não mostra valores | `services/communication.ts`, `legacyOps.ts`, `legacyClients.ts`, `paymentConfirmationService.ts`, `loans.ts`, `paymentReceipts.ts` | E2E P2: modo de teste envia só ao número de teste; pausa geral bloqueia tudo; confirmação sem valor | Provedor: **Evolution API**, instância "Tubarao", conectado. Régua, confirmações e quitação: ativos (como já eram). **Convite/regularizar automático: desligado** (aguarda teste com número autorizado) |
| 3 | Celular antigo | Fluxo próprio: contrato legado com perfil celular + ficha do aparelho (marca, modelo, IMEI, entrada, valor financiado, parcelas originais/pagas/restantes, data-base, contrato anexado). Faltando dado indispensável → pendente de conferência, sem cobrança | `legacyOps.ts` (`/devices`), tabela `legacy_device_financings` | E2E P3: pagas + restantes conferidas, 6 parcelas, **0 vendas, 0 baixas de estoque, 0 lançamentos de caixa**, sem duplicar; cliente vê no app | No ar |
| 4 | Investimento antigo | Registro próprio (`investment_records`), **fora da régua**. Sem condição de rendimento no contrato, fica pendente (não se inventa rendimento). Repasse histórico = só registro; repasse novo exige digitar REPASSAR e gera saída (OUT). Investimentos aparecem no painel do investidor no app | `legacyOps.ts`, `components/MyInvestments.tsx` | E2E P4: aporte sem caixa, 0 cobranças, repasse OUT 200, investidor vê só os próprios | No ar |
| 5 | Contestação | Admin abre pelo contrato; cliente abre pelo app ("Algo errado? Pedir conferência"). Situações: aberta, em análise, aguardando documentação, resolvida. Enquanto aberta, a obrigação fica fora da régua, **sem mudar saldo nem cancelar o contrato**. Resolver exige descrição + digitar RESOLVER, com auditoria | `legacyOps.ts`, `components/DisputeButton.tsx`, tabela `disputes` | E2E P5: bloqueio, saldo intacto, retomada só com o aviso do dia, cliente não abre em contrato de outro | No ar |
| 6 | Preferências na ficha | Seção **Preferências de comunicação** na Ficha completa (Central 360°): WhatsApp, convite, promocional (campanhas passam a respeitar), telefone confirmado, telefone inválido, suspensão temporária com motivo e data. Data da última alteração e auditoria. Checadas na hora do envio, inclusive para mensagem já na fila | `pages/admin/Customers.tsx`, `CommunicationPreferences`, `campaigns.ts` | E2E P6: suspensão feita depois do início da rodada barra o envio; auditoria `COMMUNICATION_PREFS_UPDATED` | No ar |
| 7 | Migração antiga | Finalidade: o cliente se recadastrava e o admin validava. Dependia da tabela `contract_migrations`, que **nunca existiu** (todo uso dava erro 500), e o app chamava `/api/api/...`. Em produção há 1 único pedido, de março, já REJECTED. O módulo novo cobre a função. Resultado: item removido do menu; `/admin/contract-migrations` redireciona para Clientes Antigos; "Já sou cliente" no app agora só avisa a equipe (sem criar cobrança). Endpoints preservados e nenhum dado apagado | `App.tsx`, `ReturningClientNotice.tsx`, `returningClients.ts` | E2E P7; Playwright: redireciona e o item sumiu do menu | No ar |

## Fluxo do proprietário (celular)
Clientes Antigos → **1. Cliente** (telefone, busca por cadastro existente) → **2. Serviço** (cartões grandes com o catálogo real + Celular + Investidor, cada um com os campos da modalidade) → **3. Conferência** (resumo + "conferi o saldo") → Salvar → "Preparar convite do app" / "Registrar outro serviço". O painel do topo mostra 14 indicadores calculados do banco (contas, convites, contratos, celulares, investimentos, pendências, contestações, comunicação suspensa, lembretes, enviadas, falhas).

## Banco
- Migração `20261125020000_legados_pendencias`, só acréscimos: 6 colunas em `customers` (preferências), 1 em `loans` (contrato anexado) e 4 tabelas novas (`legacy_device_financings`, `investment_records`, `investment_payouts`, `disputes`). Aplicada com RC=0; contagens antes e depois iguais (2661 / 71 / 466 / 296 / 152 / 67139 auditorias).
- Backup: `/home/ubuntu/backups/pre-legados-pendencias-20261125-143938`. Restaurado em container descartável com contagens idênticas; migração **e rollback** ensaiados nele.
- Migrações da sessão: `20261125000000_clientes_antigos`, `20261125010000_regua_controle`, `20261125020000_legados_pendencias`.

## Testes
- Unitários: **158 aprovados, 5 reprovados** (os mesmos 5 preexistentes da regra AUTONOMO, não alterados).
- Ponta a ponta em cópia descartável da produção (WhatsApp, e-mail e push interceptados): **71/71**, sendo as 36 anteriores + 35 novas. Roteiro versionado em `backend/scripts/e2e-clientes-legados.ts` (recusa rodar fora do banco descartável).
- Visual (desktop 1440, iPhone 390, Android 360): 8 telas novas por aparelho, todas as checagens ok e sem rolagem lateral. Prints `prints/homologacao/*-20..27`. Nos aparelhos, o selo "MODO DEMO" (que só existe na demonstração) ficava sobre os botões e foi retirado do DOM apenas durante os prints; isso gerou 2 avisos de DOM no teste que não ocorrem em produção (a mesma rodada sem a remoção, no desktop, deu 0 erros).

## Configuração atual
- **Régua:** ligada; 7, 5 e 3 dias; 9h, America/Sao_Paulo; 1 rodada por dia. Já rodou hoje às 9h, então os novos avisos começam **amanhã (26/11) às 9h**. A rodada de amanhã envia D-7, D-5 e D-3 apenas das cobranças que vencem exatamente nessas datas, sem retroativos.
- **WhatsApp:** Evolution conectado. Automações ligadas (como já estavam). Convite/regularizar pelo sistema: **desligado**. Modo de teste: vazio.

## Pendências reais (não está tudo automático)
1. **Teste controlado do convite automático:** em Automações WhatsApp, colocar o número autorizado em "Modo de teste" e ligar "Convite e regularizar pelo sistema". Gerar 1 convite e conferir a chegada. Depois, esvaziar o modo de teste para envio real. Não fiz o envio real porque não tenho um número autorizado.
2. **Texto do D-5:** é cópia do D-7 com "5 dias" e passa a ser enviado a partir de amanhã. Revisar em Mensagens se quiser outro texto.
3. **Confirmação de entrega (lido/entregue):** a Evolution não registra isso no sistema hoje. O histórico mostra enviado/falha/bloqueado.
4. **Investidor pelo app (pedido novo):** continua no fluxo antigo de solicitações. Não há nenhum investidor em produção, e o painel novo do app só mostra investimentos registrados aqui.
5. Erros 500 antigos de `/api/returning-clients` (lista da tela antiga) param quando os navegadores carregarem a versão nova, que redireciona.

## Rollback
- Front: promover o deploy `49d405e` na Vercel.
- Backend: `git checkout 49d405e` + `npm run build` + `pm2 restart tubarao-backend` (o código anterior ignora as colunas e tabelas novas).
- Banco: `20261125020000_legados_pendencias/rollback.sql` (aborta se já houver celulares, investimentos ou contestações), ou o backup `pre-legados-pendencias-20261125-143938`.
- D-5: desmarcar "5 dias" em Réguas de Cobrança → Salvar.
