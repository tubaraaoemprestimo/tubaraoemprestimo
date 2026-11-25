# 01 — Diagnóstico (25/11/2026)

**Pedido (áudio 08:29, 57 s):** cadastrar clientes antigos pelo telefone, com o serviço contratado (inclusive moto e celular) e a taxa, para o app cobrar sozinho pela régua (avisos de 7, **5** e 3 dias), sem mensagens manuais.

## O que existia
| Item | Situação encontrada |
|---|---|
| `routes/returningClients.ts` + `ContractMigrations.tsx` | Fluxo antigo em que o **cliente** se recadastra. Listagem/validação/rejeição só exigiam login: **qualquer cliente logado podia listar e validar migrações**. Usa a tabela `contract_migrations`, que não existe no banco (GET → 500), e o front chama `/api/api/...`. |
| Cadastro sem CPF | `customers.cpf` é NOT NULL UNIQUE. O cadastro pelo app já usa identificador provisório `REG_<id>_<4>` (2.652 de 2.661 clientes). |
| Catálogo de serviços | Tabela real `service_catalog_entries` (CLT, AUTONOMO, GARANTIA, MOTO, LIMPA_NOME, FINANCIAMENTO_CELULAR inativo). |
| Régua | Avisos de 7 e 3 dias, vencimento e atrasos. Sem aviso de 5 dias, sem marca de "não cobrar", sem opt-out. |
| Login | Vincula cliente à conta por **e-mail** (backfill em `/auth/login`). |

## Riscos identificados e tratados
1. Falha de permissão em `returning-clients` → rotas de admin agora exigem `requireAdmin`.
2. Gravar e-mail no pré-cadastro permitiria que alguém com aquele e-mail herdasse os contratos sem convite → o pré-cadastro não grava e-mail; a ativação recusa e-mail usado em outro cadastro.
3. Saldo antigo não conferido entrar na régua e gerar multa → contrato nasce **suspenso** até o admin confirmar; vencimento no passado é recusado.
4. Contrato antigo com uma só cobrança cadastrada seria tratado pela régua como "última parcela" e a mensagem pediria o saldo inteiro → ajuste em `getCollectionContext` apenas para `isLegacy`.
