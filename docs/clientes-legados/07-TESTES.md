# 07 — Testes

## Backend unitário (vitest)
151 aprovados, 5 reprovados. Os 5 reprovados são os testes da regra de juros do AUTONOMO e já falhavam antes desta mudança (mesmo resultado com `git stash`); o tema não foi retomado, por instrução do dono. Novo arquivo: `src/routes/__tests__/legacyClients.test.ts` (telefone e CPF).

## Integração (Postgres descartável, cópia do backup de 25/11, WhatsApp desligado)
31 verificações, **todas aprovadas**:
- sem login 401; cliente comum 403; `returning-clients` GET por cliente 403 (antes liberado)
- catálogo real; telefone e CPF inválidos 400
- pré-cadastro só com telefone; telefone repetido exige confirmação; busca por telefone
- não cria conta
- serviço fora do catálogo 400; vencimento no passado 400; cobrança maior que o saldo 400
- saldo não conferido nasce suspenso; referência não duplica; quitado sem parcela; 1 cobrança sem duplicar
- **nenhum lançamento de caixa**
- confirmação libera a régua
- convite em simulação; link sem dados pessoais; banco só com hash; convite anterior revogado; `check` não expõe dados
- dígitos errados 403; ativação ok; conta ligada ao cadastro e contratos preservados; token de uso único; não convida quem já tem conta
- CPF exigido quando cadastrado; 5 erros invalidam
- auditoria sem tokens

Bug encontrado e corrigido pelo teste: a busca por telefone sem CPF devolvia a base inteira.

## Régua
Na cópia: 151 cobranças abertas, 148 elegíveis (as 3 legadas suspensas ficam de fora).

## Frontend
`tsc` e `vite build` ok. Playwright (modo demo, dados fictícios): sem rolagem horizontal em 320/390/768/1440 px; 5 serviços no seletor; convite com botão de WhatsApp; importação de 4 linhas → 2 válidas e 2 com problema; página de ativação ok; 0 erros de página. Prints em `prints/`.
