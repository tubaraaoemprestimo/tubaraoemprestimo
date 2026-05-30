/**
 * Setup de testes do backend (vitest) — bugfix spec "correcao-calculo-juros-parcelas".
 *
 * PROBLEMA: os testes do spec usam um "seam" `tryLoadEngine()` que faz
 * `require('../interestEngine')` para resolver dinamicamente o engine quando ele
 * existir. O vitest executa os arquivos `.ts` em contexto ESM e fornece um
 * `require` nativo (CommonJS) que NÃO sabe compilar/resolver arquivos `.ts` —
 * então `require('../interestEngine')` lança "Cannot find module" e o seam cai
 * no fallback (réplica de 10%), fazendo o teste nunca enxergar o engine real.
 *
 * SOLUÇÃO (apenas infraestrutura de teste, aditiva e reversível — não toca em
 * produção nem nos arquivos de teste): registrar o hook do `tsx` (já presente
 * como devDependency do backend) no sistema de módulos CommonJS. Isso ensina o
 * `require` nativo a compilar e resolver `.ts`/`.tsx` em tempo de execução, de
 * modo que `require('../interestEngine')` passe a carregar o módulo real.
 *
 * Reversível: remover este setup (e a referência no vitest.config.ts) restaura
 * exatamente o comportamento anterior.
 */
// O register do tsx patcheia require.extensions para .ts/.tsx no contexto CJS.
import { register } from 'tsx/cjs/api';

register();
