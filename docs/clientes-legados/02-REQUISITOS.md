# 02 — Requisitos atendidos

| Requisito | Como |
|---|---|
| Pré-cadastro só com telefone | `POST /api/legacy-clients` (admin). Telefone normalizado para `55+DDD+número`. |
| Sem CPF fictício | Sem CPF, usa o identificador provisório **oficial do sistema** (`REG_LEGADO_<12 hex>`, mesmo padrão `REG_` do cadastro pelo app). Não é um CPF, não passa em validação de CPF e é trocado pelo CPF real na ativação. |
| Sem conta automática | Pré-cadastro não cria `users`; `activation_status = PRE_CADASTRO`. |
| Sem fusão por telefone | Telefone repetido → 409 `PHONE_IN_USE`; o admin confirma que é outra pessoa. CPF repetido → 409 bloqueante. |
| Serviço do catálogo real | `GET /api/legacy-clients/services` lê `service_catalog_entries`. |
| Contrato legado sem caixa | Cria `loan_requests` + `loans` (`is_legacy`) + 1 cobrança; **nenhuma** linha em `transactions`. |
| Não duplicar | `legacy_reference` única por cliente (índice + checagem). |
| Não cobrar saldo não confirmado | `collection_suspended = true` até `PATCH .../collection {confirmBalance:true}`. |
| Sem encargos retroativos | Vencimento no passado recusado; cobrança maior que o saldo recusada. |
| Convite seguro | Token de 256 bits, só o SHA-256 no banco, 7 dias, uso único, revogável; novo convite revoga o anterior; link sem dados pessoais. |
| Ativação com verificação | Token + 4 últimos dígitos do telefone + CPF (se cadastrado); 5 erros invalidam o convite. |
| WhatsApp desligado até homologar | Sem `LEGACY_WHATSAPP_ENABLED` → modo simulação: admin recebe o texto e o botão "Abrir no WhatsApp". |
| Aviso de 5 dias | `processDueInDays(5)` + templates `INSTALLMENT_DUE_5_DAYS`; liga com `COLLECTION_DUE_5_DAYS_ENABLED=true`. |
| Opt-out | `customers.whatsapp_opt_out` → régua não manda WhatsApp (e-mail e push seguem). |
| Importação | CSV com pré-visualização, validação por linha, nada enviado, contratos entram suspensos. |
| Nada a familiares/referências | O módulo só usa o telefone do titular. |

Fora do escopo (pedido de terceiro nos áudios das 08:52 sobre plataforma de cursos): não tratado.
