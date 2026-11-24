# 06 — Testes (resultados reais)

| Teste | Resultado |
|---|---|
| `npx tsc --noEmit` (frontend, arquivos alterados) | sem erros |
| `npx vite build` (frontend) | ok |
| `npx tsc --noEmit` (backend) | sem erros |
| `npx vitest --run` (backend) | **138 passaram, 5 falharam** |
| Novos testes `manutencao20261123.test.ts` | **6/6 passaram** |

As 5 falhas são em `interestEngine.bug.test.ts` / `interestEngine.fix.test.ts` (regra AUTONOMO: exclusão de domingos). **Já falhavam antes desta manutenção** (mesmo resultado em `main` sem as mudanças). Não são regressão.

## Testes novos (backend)
1. Cliente comum: 403 em `GET /api/customers` e `GET /api/customers/:id`; admin: 200.
2. Duas aprovações simultâneas do mesmo comprovante: uma 200, outra 409; pagamento aplicado **uma** vez.
3. Rejeitar comprovante já aprovado: 409, status continua APPROVED.
4. Cliente enviando comprovante para parcela de outro cliente: 404.
5. Comprovante de parcela já paga: 409 `INSTALLMENT_ALREADY_PAID`, nada aplicado.
6. Edição de contrato: auditoria com `{field, from, to}`; data inválida = 400.

## Validação visual (modo demo, dados fictícios, Chromium/Playwright)
- Gestão de Clientes em 320, 360, 375, 390, 414, 430, 768, 1024 e 1440 px: **sem rolagem horizontal** (scrollWidth = clientWidth em todas).
- Ficha completa a 390 px: sem rolagem horizontal; "← Voltar" fecha.
- Busca "maria" mantida após sair para o Dashboard e voltar.
- Prints em `prints/`.

## Não executado
- Safari em iPhone real e Chrome em Android real (só emulação de largura no Chromium).
- Login real em produção com dados reais (proibido usar dados reais em preview).
- Erro de página **preexistente** no modo demo em Contratos (`(installments ?? []).filter is not a function`, dado do mock) — reproduzido também em `main`; não corrigido.
