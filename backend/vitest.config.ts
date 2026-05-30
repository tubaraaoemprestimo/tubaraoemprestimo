import { defineConfig } from 'vitest/config';

/**
 * Configuração de testes LOCAL do backend.
 *
 * Por que existe: sem este arquivo, o vitest sobe na árvore e herda o
 * `vite.config.ts` da RAIZ (app React, com `@vitejs/plugin-react`) e o
 * `package.json` da raiz que declara `"type": "module"`. Nesse contexto os
 * testes são interpretados como ESM e `require` fica `undefined`, quebrando o
 * "seam" `tryLoadEngine()` (`require('../interestEngine')`) usado pelos testes
 * do bugfix spec "correcao-calculo-juros-parcelas".
 *
 * O backend é CommonJS (`backend/package.json` sem `"type": "module"`,
 * `tsconfig.json` com `"module": "commonjs"`). Fixar o `root` aqui faz o vitest
 * usar ESTA configuração (sem o plugin React) e interpretar os testes no
 * contexto CommonJS do backend, onde `require` está disponível — alinhando o
 * ambiente de teste ao runtime real do backend.
 *
 * Mudança aditiva, local e reversível: não altera produção nem os testes.
 */
export default defineConfig({
  root: __dirname,
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // Expõe um global `require` no contexto ESM dos testes para que o "seam"
    // tryLoadEngine() (require('../interestEngine')) resolva o engine real.
    setupFiles: ['src/services/__tests__/_setup.ts'],
    // O hook do tsx (register no setup) patcheia require.extensions globalmente.
    // Em pool multi-worker isso pode disparar OOM durante a coleta do projeto.
    // Usar um único fork mantém o registro estável e o consumo de memória baixo.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
